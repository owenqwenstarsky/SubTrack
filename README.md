# Subtrack

Self-hostable single-user subscription tracker with a web app, API server, and Expo mobile client.

## Project layout

- `web/` - Vite/React web app for managing subscriptions in the browser
- `server/` - Express API server, authentication, Prisma schema, and database migrations
- `mobile/` - Expo/React Native app for connecting to one or more self-hosted Subtrack servers

## Requirements

- Node.js/npm
- PostgreSQL database

## Setup

1. Install dependencies from the repo root:
   ```bash
   npm install
   ```
2. Copy the example environment file and edit values:
   ```bash
   cp .env.example .env
   ```
3. Generate Prisma Client and run migrations:
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

## Development

Start the API server:

```bash
npm run dev:server
```

Start the web app in another terminal:

```bash
npm run dev:web
```

The Vite dev server proxies `/api` requests to `http://localhost:3000`.

## Scripts

From the repo root:

- `npm run dev` - start the API server
- `npm run dev:server` - start the API server in watch mode
- `npm run dev:web` - start the Vite web app
- `npm run build` - build the web app
- `npm run start` - start the API server without watch mode
- `npm run test` - run server, web, and mobile tests
- `npm run typecheck` - typecheck all workspaces
- `npm run prisma:migrate` - run Prisma migrations using `server/prisma/schema.prisma`
- `npm run prisma:deploy` - deploy Prisma migrations

## Authentication

The app is designed for a single self-hosted user. Set `APP_PASSWORD` in `.env`, then sign in with that password.

Protected API routes accept either:

- a browser cookie session created by `POST /api/auth/login`, or
- the `x-subtrack-password` header, used by the mobile app and other non-browser clients

## Production

Build the web app:

```bash
npm run build
```

Then start the server:

```bash
npm run start
```

When `NODE_ENV=production`, the server serves the built web app from `web/dist`.

## Workspace READMEs

- [Web app](web/README.md)
- [Server](server/README.md)
- [Mobile app](mobile/README.md)
