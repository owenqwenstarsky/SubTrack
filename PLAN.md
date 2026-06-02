# Subtrack Implementation Plan

## Goal
Build a self-hostable, single-user subscription tracker with a React/Vite frontend, Express API backend, PostgreSQL storage, and Prisma ORM.

## Architecture
- **Frontend:** Vite + React + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui-ready configuration
- **Backend:** Express server mounted separately from Vite dev server
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** Single shared password from `APP_PASSWORD` environment variable
- **Session:** HTTP-only signed cookie containing a server-side session token

## Data Model
Create a `Subscription` model with:
- `id`
- `name`
- `description`
- `amount`
- `currency`
- `billingInterval`
- `billingIntervalCount`
- `firstPaymentDate`
- `nextPaymentDate`
- `category`
- `website`
- `notes`
- timestamps

Supported intervals:
- daily
- weekly
- monthly
- yearly

## API Endpoints
### Auth
- `POST /api/auth/login` — validate password and set auth cookie
- `POST /api/auth/logout` — clear auth cookie
- `GET /api/auth/me` — return authenticated status

### Subscriptions
- `GET /api/subscriptions` — list subscriptions
- `POST /api/subscriptions` — create subscription
- `GET /api/subscriptions/:id` — read one subscription
- `PUT /api/subscriptions/:id` — update subscription
- `DELETE /api/subscriptions/:id` — delete subscription

### Timeline
- `GET /api/timeline` — return future payment occurrences sorted by date, including days until payment

## Frontend Pages
Leave page implementations blank with descriptive placeholders for a future frontend model:
- Login page
- Dashboard/subscriptions list page
- Add subscription page
- Edit subscription page
- Timeline page

## Setup Tasks
1. Create project configuration files.
2. Add Prisma schema and generated client setup.
3. Add Express backend with cookie-based auth middleware.
4. Add validation for API payloads.
5. Add subscription date calculation helpers.
6. Add blank React pages and routing placeholders.
7. Add README setup instructions.
