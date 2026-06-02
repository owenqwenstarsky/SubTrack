# Subtrack

Self-hostable single-user subscription tracker.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env file and edit values:
   ```bash
   cp .env.example .env
   ```
3. Run Prisma migrations:
   ```bash
   npm run prisma:migrate
   ```
4. Start API server:
   ```bash
   npm run dev
   ```
5. In another terminal, start Vite:
   ```bash
   npm run dev:vite
   ```

## API

All subscription and timeline routes require login first with `POST /api/auth/login` using the password in `APP_PASSWORD`.

## Mobile app

An Expo scaffold lives in `mobile/`. It supports storing multiple SubTrack instances by URL/password and includes mobile API/persistence helpers plus placeholder screens for a future UI implementation.

```bash
cd mobile
npm install
npm run start
```
