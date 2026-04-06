# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install all workspace dependencies
pnpm install

# Development (API on :3001, Web on :3000, in parallel)
pnpm run dev
pnpm run dev:api    # Fastify only (tsx watch)
pnpm run dev:web    # Next.js only

# Build
pnpm run build      # both apps
pnpm run build:api  # cd apps/api && tsc
pnpm run build:web  # cd apps/web && next build

# Database
pnpm run db:migrate

# Lint (web only — no linter configured for API)
pnpm --filter @proxy-netmail/web lint

# Production (requires prior build)
bash start.sh         # simple two-process start
pnpm run start:pm2    # via ecosystem.config.js
```

No automated tests are configured. API endpoints are tested manually with curl against `http://localhost:3001`.

## Architecture

### Monorepo layout

pnpm workspaces with three packages:
- `@proxy-netmail/api` → `apps/api/` — Fastify backend
- `@proxy-netmail/web` → `apps/web/` — Next.js 14 frontend
- `@proxy-netmail/shared` → `packages/shared/` — TypeScript types only (no runtime code)

Shared types are imported as `import type { Account, ... } from '@proxy-netmail/shared'`. To add a type: define it in `packages/shared/src/types/`, re-export from `packages/shared/src/index.ts`.

### API (`apps/api/src/`)

Entry point is `server.ts`. Plugin registration order matters: `cors → database → auth`, then all route plugins.

**Plugin pattern** — all plugins use `fastify-plugin` so decorations are not scoped. The `database` plugin decorates `fastify.db` (a `mysql2/promise` Pool). The `auth` plugin decorates `fastify.authenticate` (a preHandler) and mounts `POST /api/auth/login`. Auth is **not yet enforced** on any route handler (no `preHandler: [fastify.authenticate]`) — this is intentional for the current phase.

**Route pattern** — each file exports a `FastifyPluginAsync` registered in `server.ts` with a prefix. Two route plugins share the `/api/accounts` prefix (`accountRoutes` + `setupRoutes`) — Fastify handles this without conflict.

**Query pattern** — raw `mysql2/promise` in `src/db/queries/`. Always `pool.execute<RowDataPacket[]>(...)` then `.map(row => ({...}))` manually. TIMESTAMP columns come back as JS `Date` objects — call `.toISOString()`. JSON columns may come back as string or object — guard with `typeof row.x === 'string' ? JSON.parse(row.x) : row.x`.

**Service pattern** — pure functions, no classes. Platform-aware: NGINX shell commands and certbot skip on `process.platform === 'win32'` (they log a warning and return simulated success). Health TCP probes work cross-platform (Node.js `net`).

**SSE pattern** (used in `routes/setup.ts` and `routes/health.ts`):
```typescript
reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
const heartbeat = setInterval(() => reply.raw.write(': heartbeat\n\n'), 15000);
// For finite pipelines: try { ... } finally { clearInterval(heartbeat); reply.raw.end(); }
// For long-lived streams: cleanup on request.raw.on('close', ...)
```

**Scheduler** — `startScheduler(server.db)` is called after `server.listen()`. It reads `health_check_interval_minutes` from `system_config` once at startup and schedules a `node-cron` job that TCP-probes all `proxy_status = 'running'` accounts. Health events are broadcast via `healthEmitter` (a module-level `EventEmitter` in `health.service.ts`) keyed as `check:{accountId}`.

**Setup pipeline** (`services/setup.service.ts`) — 7 sequential steps: DNS check → write no-SSL NGINX config → backup existing config → run certbot → write SSL NGINX config → upsert ssl_certificates row → set `proxy_status = 'running'`. Each step emits a `SetupEvent` for SSE. `proxy_status` is updated via direct SQL (not `UpdateAccountDto`) to keep the DTO clean.

### Web (`apps/web/src/`)

Next.js 14 App Router with two route groups:
- `(auth)/login` — unauthenticated
- `(dashboard)/` — protected by `next-auth/middleware` (configured in `src/middleware.ts`)

All dashboard pages are `'use client'` components that fetch on mount. The `api<T>(path, options?)` helper in `src/lib/api.ts` wraps fetch with base URL from `NEXT_PUBLIC_API_URL` and optional Bearer token.

SSE is consumed via `fetch` + `ReadableStream` (not `EventSource`) so POST semantics work. See `components/setup/setup-progress.tsx` for the pattern.

shadcn/ui components in `src/components/ui/` are **Tailwind CSS v3 compatible** (HSL variables, not oklch). Do not run `npx shadcn@latest` — it installs v4 components that are incompatible with Tailwind v3.

### Database

Remote MySQL on Hostinger: `srv1782.hstgr.io` / `u669953139_netmailDB`.

**Critical**: The `DATABASE_PASSWORD` in `apps/api/.env` must be quoted because it contains `#` (which `.env` parsers treat as a comment without quotes):
```
DATABASE_PASSWORD="u669953139_netmail#$PWD"
```

Six tables: `accounts`, `ssl_certificates`, `health_checks`, `activity_log`, `diagnostics`, `system_config`. Schema is in `apps/api/src/db/schema.sql`. Run migrations with `pnpm run db:migrate` (idempotent — uses `CREATE TABLE IF NOT EXISTS`).

### Environment files

- `apps/api/.env` — not committed, contains DB credentials and JWT secret
- `apps/web/.env.local` — not committed, contains NextAuth config and admin credentials
