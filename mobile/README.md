# Subtrack Mobile

Expo/React Native client for connecting to one or more self-hosted Subtrack servers.

The app includes screens for managing saved server instances, browsing subscriptions, creating and editing subscriptions, viewing subscription details, and viewing the upcoming payment timeline.

## Setup

From the repo root:

```bash
npm install
npm run test:mobile
npm --workspace mobile run start
```

Or from this directory:

```bash
cd mobile
npm install
npm run start
```

## Connecting to a server

1. Start or deploy a Subtrack API server.
2. Open the mobile app.
3. Add an instance with:
   - a display name
   - the server base URL, for example `http://192.168.1.20:3000`
   - the `APP_PASSWORD` configured on that server

The app stores instance metadata in AsyncStorage and stores passwords with Expo SecureStore.

## Routes

- `/` - saved instance list
- `/instances/new` - add and test a server instance
- `/instances/[instanceId]` - subscriptions for one instance
- `/instances/[instanceId]/subscriptions/new` - create subscription
- `/instances/[instanceId]/subscriptions/[subscriptionId]` - subscription details
- `/instances/[instanceId]/subscriptions/[subscriptionId]/edit` - edit subscription
- `/instances/[instanceId]/timeline` - upcoming payment timeline

## Structure

- `app/` - Expo Router screens
- `src/forms/` - subscription form UI and form helpers
- `src/lib/api.ts` - API client for Subtrack servers
- `src/lib/instances.ts` - saved instance persistence
- `src/lib/types.ts` - mobile API and domain types
- `src/lib/format.ts` - date, currency, and billing interval formatting
- `src/ui/` - reusable native UI components and theme tokens
- `tests/` - Vitest tests for API helpers, formatting, instances, and form helpers

## Scripts

- `npm run start` - start Expo
- `npm run android` - start Expo for Android
- `npm run ios` - start Expo for iOS
- `npm run web` - start Expo web
- `npm run typecheck` - run TypeScript checks
- `npm run test` - run Vitest
- `npm run test:coverage` - run Vitest with coverage
