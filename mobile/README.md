# SubTrack Mobile

Expo mobile app scaffold for managing multiple self-hosted SubTrack instances.

## Setup

```bash
cd mobile
npm install
npm run start
```

## Structure

- `app/` contains Expo Router screens. Screens are intentionally placeholders with implementation descriptions for a future frontend pass.
- `src/lib/instances.ts` persists the list of configured SubTrack instances. Instance metadata is stored with AsyncStorage and passwords are stored with Expo SecureStore.
- `src/lib/api.ts` contains helpers for logging into an instance and calling the SubTrack API.
- `src/lib/types.ts` contains shared API types.
- `src/lib/format.ts` contains UI formatting helpers.

## Routes

- `/` instance list
- `/instances/new` add instance
- `/instances/[instanceId]` subscriptions for one instance
- `/instances/[instanceId]/subscriptions/new` add subscription
- `/instances/[instanceId]/subscriptions/[subscriptionId]` subscription details
- `/instances/[instanceId]/subscriptions/[subscriptionId]/edit` edit subscription
- `/instances/[instanceId]/timeline` timeline
