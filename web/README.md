# Subtrack Web

Vite/React web app for the Subtrack subscription tracker.

## Features

- Password login against the Subtrack API
- Subscription list, details, create, edit, and delete flows
- Upcoming payment timeline
- Date, currency, and billing interval formatting helpers
- React component and helper tests with Vitest and Testing Library

## Development

From the repo root:

```bash
npm install
npm run dev:web
```

Or from this directory:

```bash
cd web
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:3000`, so start the API server separately:

```bash
npm run dev:server
```

## Routes

- `/login` - password login
- `/` - subscriptions
- `/subscriptions/new` - create subscription
- `/subscriptions/:id` - subscription details
- `/subscriptions/:id/edit` - edit subscription
- `/timeline` - upcoming payment timeline

## Structure

- `src/main.tsx` - React Router setup
- `src/pages/` - route-level pages
- `src/components/` - reusable app components and UI primitives
- `src/lib/api.ts` - browser API client
- `src/lib/format.ts` - formatting helpers
- `src/styles.css` - Tailwind/global styles
- `tests/` - frontend tests

## Scripts

- `npm run dev` - start Vite
- `npm run build` - build to `web/dist`
- `npm run typecheck` - run TypeScript checks
- `npm run test` - run Vitest
- `npm run test:coverage` - run Vitest with coverage
