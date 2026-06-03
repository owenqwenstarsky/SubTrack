# MCP Support Implementation Plan

## Goal

Add a first-class MCP server to the existing SubTrack API so agent clients can authenticate with the existing SubTrack password and use a complete, well-described tool suite for managing subscriptions, reading payment details, and planning upcoming payments.

The implementation should be easy for common MCP-capable LLM clients to connect to without custom client code. It should preserve the app's current single-user, self-hosted security model and avoid creating a separate data or auth path that can drift from the REST API.

## Current System Context

- The API server is Express-based and created by `server/src/app.ts`.
- Authentication is single-user:
  - browser cookie sessions from `POST /api/auth/login`
  - `x-subtrack-password` header for non-browser clients
- CSRF protection is skipped for valid password-header requests, which is already the right fit for non-browser API clients.
- Subscription validation is centralized in `server/src/validation.ts` with Zod.
- Subscription serialization is centralized in `server/src/serializers.ts`.
- Recurring payment calculations live in `server/src/dateUtils.ts`.
- Tests already use `createApp({ prisma })` with an injected Prisma-like store, which should be reused for MCP route tests.

## Protocol And SDK Direction

Use the official TypeScript MCP SDK and implement MCP over Streamable HTTP.

Rationale:

- Streamable HTTP is the recommended transport for remote MCP servers.
- HTTP + SSE is deprecated and should not be the initial implementation target.
- A stateless MCP server is a good match for SubTrack's current API-style usage because the tools are short-lived CRUD/read operations and do not require resumable server sessions.
- The MCP endpoint can live inside the existing Express API process and share Prisma, validation, logging, and auth middleware.

Recommended package:

```bash
npm install --workspace server @modelcontextprotocol/sdk
```

## Proposed Public Surface

Add one MCP endpoint:

```text
POST /api/mcp
GET /api/mcp
DELETE /api/mcp
```

The endpoint should use the SDK's Streamable HTTP server transport. If the chosen stateless transport only requires `POST`, still register `GET` and `DELETE` handlers so clients receive protocol-appropriate responses instead of Express 404s.

Authentication should require the existing password header:

```text
x-subtrack-password: <APP_PASSWORD>
```

Optionally also accept:

```text
Authorization: Bearer <APP_PASSWORD>
```

This optional bearer alias improves compatibility with MCP clients that are easier to configure with a single authorization header. Internally, normalize it to the same password check and do not create a second secret.

Do not require cookie sessions for MCP in the first version. Cookie sessions make CSRF and browser-origin behavior more complex, and most MCP clients are non-browser agents.

## Security Requirements

1. Reuse the existing `APP_PASSWORD`; do not add another default secret.
2. Require auth before constructing or invoking any MCP tool handler.
3. Keep MCP under `/api/mcp` so production NGINX and existing API routing remain predictable.
4. Use Express JSON body limits consistent with the current API. Increase only if a real MCP payload requires it.
5. Add host-header/DNS-rebinding protection if the SDK's Express helper or middleware is compatible with the current app. This matters for self-hosted localhost deployments.
6. Return `401` for missing or invalid credentials. If bearer auth is supported, include a clear `WWW-Authenticate` header.
7. Do not expose raw database errors through MCP tool responses.
8. Do not allow arbitrary SQL, arbitrary file access, network fetches, shell execution, or unaudited "generic API call" tools.
9. Treat delete operations as destructive and make their tool descriptions explicit.
10. Keep all tool input schemas strict and bounded with Zod.

## File-Level Design

### `server/src/auth.ts`

Add small helpers that can be reused by REST and MCP:

- `getPasswordFromRequest(req)`:
  - return `x-subtrack-password` when present
  - return bearer token when `Authorization: Bearer ...` is present
- `hasValidPasswordCredential(req)`:
  - compare extracted credential to `process.env.APP_PASSWORD`
- Keep `hasValidPasswordHeader` for backward compatibility or update it to call the new helper.

### `server/src/subscriptionService.ts`

Extract subscription business operations out of route handlers so REST and MCP share behavior:

- `listSubscriptions(prisma)`
- `createSubscription(prisma, input)`
- `getSubscription(prisma, id)`
- `getSubscriptionDetails(prisma, id, options)`
- `updateSubscription(prisma, id, input)`
- `deleteSubscription(prisma, id)`
- `getTimeline(prisma, input, options)`

This extraction should preserve current REST responses and status behavior. Use typed domain errors such as `NotFoundError` and `ValidationError` only where they simplify route/tool mapping.

### `server/src/mcp/server.ts`

Create and configure the MCP server:

- `createSubtrackMcpServer({ prisma, maxGeneratedPayments })`
- Register all tools, resources, and prompts.
- Keep tool handlers thin; they should call `subscriptionService`.
- Return structured content and structured output where the SDK supports it.

### `server/src/mcp/http.ts`

Mount the MCP transport into Express:

- `mountMcpRoutes(app, { prisma, maxGeneratedPayments })`
- Apply MCP auth middleware only to `/api/mcp`.
- Use stateless Streamable HTTP unless a specific client compatibility issue requires stateful sessions.
- Translate SDK/transport errors into protocol-compliant responses.

### `server/src/app.ts`

Wire `mountMcpRoutes` after JSON parsing and auth helper setup, before production static serving and the final error handler.

### `server/tests/mcp.test.ts`

Add MCP-specific tests with the existing injected Prisma store style.

## Tool Suite

Tool names should be short, stable, snake_case, and action-oriented. Descriptions should tell the model when to use the tool and include important side effects.

### `list_subscriptions`

Read all subscriptions ordered by next payment date.

Input:

```ts
{
  includeNotes?: boolean;
}
```

Output:

```ts
{
  subscriptions: SubscriptionSummary[];
}
```

Notes:

- Default `includeNotes` to `false` to keep routine reads compact.
- Include IDs because follow-up tools need them.

### `search_subscriptions`

Find subscriptions by name, category, description, website, or notes.

Input:

```ts
{
  query: string;
  limit?: number; // 1-50, default 10
}
```

Output:

```ts
{
  subscriptions: SubscriptionSummary[];
}
```

Notes:

- This can be implemented in memory from `findMany()` initially because the dataset is single-user and likely small.
- If the dataset grows, replace with Prisma filters.

### `get_subscription`

Read one subscription by ID.

Input:

```ts
{
  id: string;
}
```

Output:

```ts
{
  subscription: Subscription;
}
```

### `get_subscription_details`

Read a subscription plus generated past payment history and stats.

Input:

```ts
{
  id: string;
}
```

Output:

```ts
{
  subscription: Subscription;
  pastPayments: Payment[];
  stats: {
    paymentsMade: number;
    totalPaid: string;
    currency: string;
    daysUntilNextPayment: number;
  };
}
```

### `create_subscription`

Create a new subscription.

Input should match `subscriptionCreateSchema`:

```ts
{
  name: string;
  description?: string | null;
  amount: number | string;
  currency?: string; // default USD
  billingInterval: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  billingIntervalCount?: number; // default 1
  firstPaymentDate: string;
  nextPaymentDate?: string | null;
  category?: string | null;
  website?: string | null;
  notes?: string | null;
}
```

Output:

```ts
{
  subscription: Subscription;
}
```

Description guidance:

- Tell agents that `firstPaymentDate` should be the first known charge date.
- Tell agents that `nextPaymentDate` is optional and will be normalized when omitted.
- Tell agents to ask the user before creating a subscription if required fields are missing.

### `update_subscription`

Update an existing subscription.

Input:

```ts
{
  id: string;
  patch: Partial<CreateSubscriptionInput>;
}
```

Output:

```ts
{
  subscription: Subscription;
}
```

Notes:

- Require at least one field in `patch`.
- Reuse the same recalculation behavior as REST when interval fields change.

### `delete_subscription`

Delete one subscription.

Input:

```ts
{
  id: string;
}
```

Output:

```ts
{
  deleted: true;
  id: string;
}
```

Description guidance:

- State clearly that this permanently deletes the subscription from SubTrack.
- Do not add a server-side confirmation flag unless the API already has one; MCP clients should handle user confirmation before calling destructive tools.

### `get_payment_timeline`

Generate upcoming payments.

Input:

```ts
{
  months?: number; // 1-36, default 12
}
```

Output:

```ts
{
  payments: UpcomingPayment[];
}
```

### `summarize_spending`

Return deterministic spending totals grouped by currency and optionally by category.

Input:

```ts
{
  months?: number; // 1-36, default 12
  groupBy?: "currency" | "category";
}
```

Output:

```ts
{
  range: { months: number };
  totals: Array<{
    key: string;
    currency: string;
    amount: string;
    paymentCount: number;
  }>;
}
```

Notes:

- This can compute from the same generated timeline used by `/api/timeline`.
- Keep it deterministic; do not generate prose analysis in the tool.

## Resources

Resources are read-only context that clients can inspect without deciding between many tools.

### `subtrack://subscriptions`

Returns the current subscription list.

### `subtrack://subscriptions/{id}`

Returns one subscription.

### `subtrack://timeline/upcoming?months={months}`

Returns upcoming generated payments.

Implementation note: resources should share the same service functions as tools.

## Prompts

Prompts help general-purpose LLMs use the tool suite correctly.

### `subscription_audit`

Purpose: help the user review subscriptions for missing metadata, unusually high costs, duplicate services, and upcoming renewals.

Arguments:

```ts
{
  months?: number;
}
```

Prompt should instruct the model to call `list_subscriptions`, `get_payment_timeline`, and `summarize_spending` before making recommendations.

### `add_subscription_from_receipt`

Purpose: help extract subscription fields from pasted receipt or email text.

Arguments:

```ts
{
  receiptText: string;
}
```

Prompt should instruct the model to identify missing required fields and ask the user before calling `create_subscription`.

## Response Shape Guidelines

For every tool:

- Prefer JSON structured output over prose.
- Also include a concise text content message for clients that display text only.
- Use ISO date strings for all dates.
- Use decimal strings for currency amounts in outputs.
- Preserve existing subscription IDs.
- Return validation errors in a compact, field-oriented form.

Example text content:

```text
Found 8 subscriptions. Next payment is Netflix on 2026-06-10.
```

Example structured content:

```json
{
  "subscriptions": []
}
```

## Implementation Phases

### Phase 1: Shared Service Extraction

1. Create `server/src/subscriptionService.ts`.
2. Move logic from REST handlers into service functions without changing route behavior.
3. Update `server/src/app.ts` REST routes to call the service.
4. Run `npm run test:server` and `npm run typecheck`.

Acceptance criteria:

- All existing API tests pass unchanged.
- REST response bodies and status codes remain compatible.

### Phase 2: MCP SDK And Auth Plumbing

1. Add `@modelcontextprotocol/sdk` to `server/package.json`.
2. Add bearer/password credential helper in `server/src/auth.ts`.
3. Create `server/src/mcp/http.ts`.
4. Mount `/api/mcp` in `server/src/app.ts`.
5. Add unauthorized MCP request tests.

Acceptance criteria:

- Missing credentials receive `401`.
- Invalid credentials receive `401`.
- Valid `x-subtrack-password` credentials can initialize/list tools.
- Valid `Authorization: Bearer <APP_PASSWORD>` works if bearer alias is included.

### Phase 3: Core Tools

1. Create `server/src/mcp/server.ts`.
2. Register:
   - `list_subscriptions`
   - `get_subscription`
   - `get_subscription_details`
   - `create_subscription`
   - `update_subscription`
   - `delete_subscription`
   - `get_payment_timeline`
3. Reuse Zod schemas from `validation.ts` where possible.
4. Add MCP tests for listing, creating, updating, deleting, details, and timeline.

Acceptance criteria:

- Tool schemas are visible through MCP tool listing.
- Tool calls perform the same validation and persistence behavior as REST.
- Destructive and mutating tools require valid credentials.

### Phase 4: Agent-Friendly Tools, Resources, And Prompts

1. Add `search_subscriptions`.
2. Add `summarize_spending`.
3. Add read-only MCP resources.
4. Add MCP prompts.
5. Add tests for resources/prompts if the SDK test ergonomics are reasonable; otherwise add smoke tests through an SDK client.

Acceptance criteria:

- A generic MCP client can discover useful tools, resources, and prompts without external docs.
- Search and summary outputs are deterministic and bounded.

### Phase 5: Documentation And Deployment

1. Update `README.md` authentication/API section with MCP connection details.
2. Update `server/README.md` with MCP endpoint, supported auth headers, and tool list.
3. Update `.env.example` only if a new optional setting is introduced.
4. Add a short MCP client configuration example.

Suggested client config shape:

```json
{
  "mcpServers": {
    "subtrack": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "x-subtrack-password": "change-me"
      }
    }
  }
}
```

If using bearer alias:

```json
{
  "mcpServers": {
    "subtrack": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer change-me"
      }
    }
  }
}
```

## Testing Strategy

Use three layers of tests:

1. Existing REST API regression tests.
2. MCP route auth and protocol smoke tests.
3. MCP tool behavior tests using an SDK client against `createApp({ prisma })`.

Minimum MCP test cases:

- unauthenticated initialize/list tools fails
- authenticated list tools succeeds
- tool names and descriptions are present
- create subscription succeeds with valid input
- create subscription returns validation error for invalid input
- list subscriptions includes created subscription
- get details returns generated past payments and stats
- update subscription recalculates `nextPaymentDate` when billing cadence changes
- delete subscription removes the row
- timeline validates `months`
- bearer alias works if implemented

Run before completion:

```bash
npm run typecheck
npm run test:server
```

If MCP tests require full workspace dependencies, also run:

```bash
npm run test
```

## Compatibility Notes

- Prefer Streamable HTTP first. Do not add deprecated HTTP + SSE unless a target MCP client requires it.
- Keep the server stateless unless client testing shows a need for resumable sessions.
- Do not expose the MCP endpoint on a different port in the first version; deployment is simpler if it shares the API origin.
- Do not implement OAuth in the first version. MCP authorization guidance for HTTP transports is OAuth-oriented, but SubTrack's product model is a single-user self-hosted app with an existing shared password. A future multi-user version should revisit OAuth or scoped API tokens.

## Future Enhancements

- Add `APP_API_TOKEN` or generated scoped tokens separate from the human login password.
- Add read-only token mode for analysis-only agents.
- Add audit logging for mutating MCP tool calls.
- Add import/export tools for subscription backups.
- Add budget thresholds and renewal warning tools.
- Add OAuth 2.1 protected resource metadata if SubTrack evolves beyond single-user password auth.

## Open Decisions

1. Should bearer-token auth be included in v1 for client compatibility, or should v1 only support `x-subtrack-password` for strict consistency with the current API?
2. Should MCP be enabled whenever `APP_PASSWORD` is set, or gated behind an explicit `MCP_ENABLED=true` environment variable?
3. Should `notes` be returned by default in MCP list/search results, or only when explicitly requested?
4. Should spending summaries use generated upcoming payments only, or include historical generated payments too?

## References

- Official MCP TypeScript SDK server docs: https://ts.sdk.modelcontextprotocol.io/documents/server.html
- Official MCP TypeScript SDK overview: https://ts.sdk.modelcontextprotocol.io/
- MCP authorization specification: https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
