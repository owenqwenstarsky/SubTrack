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
- `PORT` - API server port, defaults to `3000`

## API authentication

Protected routes require one of:

- cookie session auth from `POST /api/auth/login`, with CSRF protection for mutating browser requests
- `x-subtrack-password` header matching `APP_PASSWORD`, useful for mobile and script clients

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

## Structure

- `src/index.ts` - process entrypoint and graceful shutdown
- `src/app.ts` - Express app, middleware, and routes
- `src/auth.ts` - sessions, password auth, and CSRF helpers
- `src/dateUtils.ts` - recurring payment date calculations
- `src/prisma.ts` - Prisma Client instance
- `src/serializers.ts` - API response serialization
- `src/validation.ts` - Zod request schemas
- `prisma/schema.prisma` - database schema
- `tests/api.test.ts` - Node test runner API tests

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
