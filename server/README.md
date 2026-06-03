# Subtrack Server

Express API server for Subtrack. It owns authentication, subscription API routes, timeline generation, and the Prisma database schema.

## Setup

From the repo root:

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run dev:server
```

The server reads environment variables from the root `.env` file.

## Environment

See `../.env.example`.

Important values:

- `DATABASE_URL` - PostgreSQL connection string
- `APP_PASSWORD` - single-user login password
- `SESSION_SECRET` - cookie signing secret; required in production
- `ALLOWED_ORIGINS` - comma-separated allowed browser origins for CORS
- `MAX_GENERATED_PAYMENTS` - cap for generated history/timeline payments
- `MCP_ENABLED` - set to `true` to enable the `/api/mcp` endpoint; defaults to disabled
- `PORT` - API server port, defaults to `3000`

## API authentication

Protected REST routes require one of:

- cookie session auth from `POST /api/auth/login`, with CSRF protection for mutating browser requests
- `x-subtrack-password` header matching `APP_PASSWORD`, useful for mobile and script clients

The MCP endpoint is disabled unless `MCP_ENABLED=true`. When enabled, it requires non-browser password auth with either `x-subtrack-password: <APP_PASSWORD>` or `Authorization: Bearer <APP_PASSWORD>`.

## Main routes

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auth/csrf`
- `GET /api/subscriptions`
- `POST /api/subscriptions`
- `GET /api/subscriptions/:id`
- `GET /api/subscriptions/:id/details`
- `PUT /api/subscriptions/:id`
- `DELETE /api/subscriptions/:id`
- `GET /api/timeline`
- `POST /api/mcp` - Streamable HTTP MCP endpoint
- `GET /api/mcp` / `DELETE /api/mcp` - protocol-compatible MCP transport handlers

## MCP

Set `MCP_ENABLED=true`, then configure MCP-capable clients with the shared API endpoint:

```json
{
  "mcpServers": {
    "subtrack": {
      "url": "http://localhost:3000/api/mcp",
      "headers": { "x-subtrack-password": "change-me" }
    }
  }
}
```

Bearer auth is also supported for clients that prefer a single authorization header:

```json
{
  "mcpServers": {
    "subtrack": {
      "url": "http://localhost:3000/api/mcp",
      "headers": { "Authorization": "Bearer change-me" }
    }
  }
}
```

Tools: `list_subscriptions`, `search_subscriptions`, `get_subscription`, `get_subscription_details`, `create_subscription`, `update_subscription`, `delete_subscription`, `get_payment_timeline`, and `summarize_spending`.

Resources: `subtrack://subscriptions`, `subtrack://subscriptions/{id}`, and `subtrack://timeline/upcoming?months={months}`. Prompts: `subscription_audit` and `add_subscription_from_receipt`.

## Structure

- `src/index.ts` - process entrypoint and graceful shutdown
- `src/app.ts` - Express app, middleware, and routes
- `src/subscriptionService.ts` - shared subscription business operations used by REST and MCP
- `src/mcp/` - MCP server/tool definitions and Streamable HTTP route mounting
- `src/auth.ts` - sessions, password auth, and CSRF helpers
- `src/dateUtils.ts` - recurring payment date calculations
- `src/prisma.ts` - Prisma Client instance
- `src/serializers.ts` - API response serialization
- `src/validation.ts` - Zod request schemas
- `prisma/schema.prisma` - database schema
- `tests/api.test.ts` and `tests/mcp.test.ts` - Node test runner API and MCP tests

## Scripts

From the repo root, use `npm run <script>` names such as `dev:server` and `test:server`.

From this directory/workspace:

- `npm run dev` - start API in watch mode
- `npm run start` - start API normally
- `npm run typecheck` - run TypeScript checks
- `npm run test` - run API tests
- `npm run test:coverage` - run API tests with Node coverage
- `npm run prisma:generate` - generate Prisma Client
- `npm run prisma:migrate` - run development migrations
- `npm run prisma:deploy` - deploy migrations

## Production web serving

When `NODE_ENV=production`, the server also serves the built web app from `web/dist`. Build it first from the root:

```bash
npm run build
npm run start
```
