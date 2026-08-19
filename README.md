# SPER — Community Care App

Low-friction circle check-in system. Modular-monolith API (Fastify + Drizzle +
BullMQ on PostgreSQL + Redis) with two clients — a React Native/Expo mobile
app and a full-parity Next.js web app — sharing one DTO/enum package.

## Layout

```
apps/api            Backend (Fastify, Drizzle, BullMQ)
  src/config        env validation + DB/Drizzle client
  src/db            schema.ts (source of truth) + migrations
  src/modules       auth, users, circles, checkins, touchpoints, messages,
                     gratitude, voicenotes, notifications
  src/delivery      push (APNs/FCM) + email (SMTP) providers, notifier, DI wiring
  src/workers       prompt-scheduler + grace-loop + care-gap-loop (BullMQ)
  src/shared        errors, mappers, idempotency, middleware
  test              phase integration/e2e suites
apps/mobile         React Native / Expo client
  src/design        tokens (palette, state visuals) + strings (voice)
  src/api           typed client + TanStack Query hooks
  src/components     StateBadge, SperWidget, CareCard, ShareCard, ...
  src/screens        auth, onboarding (timezone/join/pact), main destinations
  src/navigation     RootNavigator, OnboardingStack, MainSwitcher
  src/lib            deeplink (WhatsApp/SMS bridge), offlineQueue
  src/state          session context
apps/web            Next.js client — full parity with apps/mobile
  src/app           App Router pages: auth, onboarding, (app) tab group
  src/api           typed client + TanStack Query hooks (same shape as mobile)
  src/components     same component set/names as apps/mobile, web-rendered
  src/lib           checkin/state helpers, offline queue, push (web push)
  src/state          session + theme context
  public/sw.js       service worker (web push)
packages/shared-types  enums + DTOs shared across all three apps (single source of truth)
```

## Prerequisites
Node 20+, pnpm 9, Docker (for Postgres + Redis). Android Studio (emulator) or
a physical device only if you're working on the mobile app.

## Setup
```bash
pnpm install

docker compose up -d              # Postgres 16 + Redis, per docker-compose.yml

cp .env.example apps/api/.env     # then edit secrets (JWT_*_SECRET at minimum)
pnpm --filter @sper/api db:migrate

pnpm --filter @sper/shared-types build  # compiles dist/ — required before
                                         # mobile typecheck/tests can resolve it
```

Windows/PowerShell note: `db:generate`/`db:migrate`/`db:studio` read env vars
from the shell (they aren't run through `dotenv/config` like `dev` is). Load
`apps/api/.env` into your current session first:
```powershell
. .\load-env.ps1
```

## Run
```bash
pnpm dev:api                      # starts db+redis, then the API on $PORT
# or, if db+redis are already running:
pnpm --filter @sper/api dev       # HTTP server on $PORT
pnpm --filter @sper/api worker    # prompt-scheduler + grace-loop (separate process)
```

## API (base path `/api/v1`)
- `POST /auth/register|login|magic-link|magic-link/verify|refresh`
- `POST /auth/reset-password/request|confirm`
- `GET /circles/mine`, `POST /circles`, `POST /circles/join`,
  `POST /circles/:id/invites`, `POST /circles/:id/pact/agree`,
  `GET /circles/:id/members`, `POST /circles/:id/leave`
- `POST /checkins`, `POST /checkins/:id/like`, `GET /circles/:id/sper`,
  `GET /circles/:id/care-cards`, `GET /circles/:id/share-cards`
- `POST|GET /checkins/:id/touchpoints`
- `POST|GET /checkins/:id/voice-notes`, `POST /checkins/:id/voice-notes/:noteId/received`
- `POST|GET /checkins/:id/messages`, `POST /checkins/:id/messages/:messageId/received`
- `POST /checkins/:id/gratitude`
- `GET|DELETE /users/me`, `POST|DELETE /devices`

## Tests

Both packages use **Vitest**. The API suite runs against a live Postgres +
Redis and is destructive — `test/setup.ts` truncates every table before each
test — so it must never point at your dev database. It reads its config from
`apps/api/.env.test` (loaded explicitly by `vitest.config.ts`, independent of
`.env`), not from inline env vars on the command line.

One-time setup, before the first test run:
```bash
docker compose exec db psql -U postgres -c "CREATE DATABASE sper_test;"
cp apps/api/.env.test.example apps/api/.env.test   # then edit secrets
```
`test/setup.ts` also refuses to run — even if you skip the step above and
misconfigure things later — against any `DATABASE_URL` whose database name
doesn't contain "test", as a backstop against accidentally wiping dev data.

```bash
# Backend (134 tests): services, delivery, workers, auth, HTTP e2e
pnpm --filter @sper/api test

# Mobile (15 tests): deep-link builder, offline queue, API client + refresh
# Requires @sper/shared-types to be built first (see Setup) — its vitest
# config resolves the package from dist/, not source.
pnpm --filter @sper/mobile test
```

Coverage: check-in core loop (distress detection, un-pause, atomicity, note
boundary, lone-member), sper/care-cards/share-cards + likes, multi-responder
touchpoints + ack routing, messages, gratitude, voice notes, notifier
push/email fallback + idempotency + dead-token pruning, circles/invites/pact
(single-use codes, expiry, duplicate-join, unambiguous alphabet), auth
(hashing, dup email, refresh rotation, magic link, password reset), workers
(grace pause+nudge, care-gap nudges, timezone-correct prompt scheduling), and
HTTP status/guard edges. Mobile covers the off-app bridge URLs, offline
retention/retry, and the client's 401 auto-refresh.

`apps/web` has no test suite yet — verify web changes manually (see below).

## Mobile (Expo)
```bash
cd apps/mobile
cp .env.example .env    # pick the ONE EXPO_PUBLIC_API_URL that matches how
                         # you're testing — see the comments in the file
pnpm start
```
Consumes the same `@sper/shared-types` package, so DTOs never drift from the API.

**Which `EXPO_PUBLIC_API_URL` to use** depends on where the app is running
relative to the API server (`apps/mobile/.env.example` has the full detail):
- **Android emulator**, same machine as the API: `http://10.0.2.2:3000/api/v1`
  (the emulator's alias for the host's localhost).
- **Physical device** on the same Wi-Fi: your machine's LAN IP, e.g.
  `http://192.168.1.23:3000/api/v1`.
- **Isolated/guest network**: tunnel with `ngrok http 3000` and use the
  forwarding URL instead.

To run on an Android emulator: `pnpm android` (or `expo start --android`)
launches it via the currently-booted AVD. If you have multiple emulators
running, target one explicitly with `ANDROID_SERIAL=<serial> pnpm android`
(find serials with `adb devices`).

## Web (Next.js)
```bash
pnpm --filter @sper/web dev     # http://localhost:3100
```
No `.env.example` yet — the client falls back to `http://localhost:3000/api/v1`
when `NEXT_PUBLIC_API_URL` isn't set, which matches the default local API port.
Set `NEXT_PUBLIC_API_URL` explicitly (e.g. in `apps/web/.env.local`) if the API
is running elsewhere.

Ported for full parity with `apps/mobile` — same screens, component names, and
`@sper/shared-types` DTOs, so the two clients can't drift silently. Backend
must be deployed/reachable before onboarding real (non-local) testers. Web
push uses `public/sw.js`; there is no test suite here yet, so changes need
manual verification in-browser.

