# proxy-netmail - Phase 3: Health & Monitoring

## Context
Phase 2 is complete — setup pipeline with SSE streaming, certbot SSL, activity logging. Phase 3 adds health monitoring: TCP probes per protocol (IMAP/SMTP/POP3), a cron scheduler that checks all running accounts every N minutes, on-demand checks, and a /monitor dashboard page. Health data is stored in the existing `health_checks` table.

**Shared types already defined:** `HealthCheck`, `HealthSummary`, `Protocol`, `HealthStatus` in packages/shared/src/types/health.ts — no changes needed.

---

## Implementation Plan (9 Stages + pre-install)

### Stage 0 — Install node-cron
```bash
pnpm --filter @proxy-netmail/api add node-cron
pnpm --filter @proxy-netmail/api add -D @types/node-cron
```

---

### Stage 1 — DB queries: health_checks.ts
**File:** `apps/api/src/db/queries/health_checks.ts` (new)

- `insert(pool, check: Omit<HealthCheck, 'id'|'checked_at'>): Promise<number>` — INSERT, returns insertId
- `findByAccount(pool, accountId, limit): Promise<HealthCheck[]>` — ORDER BY checked_at DESC
- `findSummaryByAccount(pool, accountId): Promise<HealthSummary | null>` — correlated subquery for latest status per protocol
- `findAllSummaries(pool): Promise<HealthSummary[]>` — same query across all accounts, GROUP BY account_id
- Map TIMESTAMP columns: `new Date(row.checked_at).toISOString()`

SQL for summaries (correlated subquery pattern):
```sql
SELECT h.account_id, MAX(h.checked_at) AS last_checked,
  MAX(CASE WHEN h.protocol = 'imap' AND h.checked_at = (SELECT MAX(checked_at) FROM health_checks WHERE account_id = h.account_id AND protocol = 'imap') THEN h.status END) AS imap,
  MAX(CASE WHEN h.protocol = 'smtp' AND h.checked_at = (SELECT MAX(checked_at) FROM health_checks WHERE account_id = h.account_id AND protocol = 'smtp') THEN h.status END) AS smtp,
  MAX(CASE WHEN h.protocol = 'pop3' AND h.checked_at = (SELECT MAX(checked_at) FROM health_checks WHERE account_id = h.account_id AND protocol = 'pop3') THEN h.status END) AS pop3
FROM health_checks h GROUP BY h.account_id
```
For `findSummaryByAccount`, add `WHERE h.account_id = ?` before GROUP BY.

---

### Stage 2 — Service: health.service.ts
**File:** `apps/api/src/services/health.service.ts` (new)

**Module-level EventEmitter** (for SSE streaming):
```typescript
export const healthEmitter = new EventEmitter();
healthEmitter.setMaxListeners(0); // prevent warnings with many SSE clients
```

**`probePort(host, port, timeoutMs): Promise<{ok, latency_ms, error?}>`**
- `net.createConnection({host, port})` wrapped in Promise
- On `'connect'`: resolve `{ok: true, latency_ms: Date.now() - start}`
- On `'error'`: resolve `{ok: false, latency_ms: null, error: err.message}`
- On `'timeout'`: resolve `{ok: false, latency_ms: null, error: 'Connection timed out'}`
- `socket.setTimeout(timeoutMs)` immediately after socket creation
- Entire Promise body in try/catch for synchronous errors

**`checkAccount(pool, accountId): Promise<HealthSummary>`**
- Load account via `accountQueries.findById`
- Probe 3 targets sequentially: IMAP:993, SMTP:465, POP3:995 (timeout 5000ms)
- Map error to HealthStatus: ok → 'ok', ECONNREFUSED → 'refused', timed out → 'timeout', else → 'unknown'
- `healthQueries.insert(pool, {account_id, protocol, status, latency_ms, error_detail})`
- Emit: `healthEmitter.emit(`check:${accountId}`, check)`
- Single `activityLog.insert` summarizing all 3 results (event_type: 'health_ok' or 'health_fail', severity determined by worst result)
- Return `healthQueries.findSummaryByAccount(pool, accountId)` (never null after insert)

---

### Stage 3 — Service: scheduler.service.ts
**File:** `apps/api/src/services/scheduler.service.ts` (new)

**`startScheduler(pool): void`**
- Reads `health_check_interval_minutes` from `systemQueries.getByKey`, default 5, min 1
- Builds cron: `*/N * * * *`, validates with `cron.validate(expr)`
- `cron.schedule(expr, async () => checkAllRunningAccounts(pool))`
- Logs schedule start to console (not activity_log)

**`checkAllRunningAccounts(pool)` (private)**
- `SELECT id FROM accounts WHERE proxy_status = 'running'`
- `for...of` loop calling `healthService.checkAccount(pool, row.id)` in individual try/catch (one failure never stops the batch)

---

### Stage 4 — Route: health.ts
**File:** `apps/api/src/routes/health.ts` (new)

- `GET /` → `healthQueries.findAllSummaries(fastify.db)` — returns `[]` if no checks exist
- `GET /:id` → `healthQueries.findByAccount(fastify.db, id, 50)` — returns `[]` if no history
- `POST /:id/check` → `healthService.checkAccount(fastify.db, id)` — returns `HealthSummary`; 404 if account not found
- `GET /:id/stream` → SSE long-lived stream using `healthEmitter.on('check:id', onCheck)`; cleanup on `request.raw.on('close', ...)` (not try/finally like setup.ts — this stream is open until client disconnects)

SSE stream pattern difference from setup.ts: no `try/finally` block; instead cleanup fires on client disconnect event.

---

### Stage 5 — Update server.ts
**File:** `apps/api/src/server.ts` (edit)

Add imports:
```typescript
import healthRoutes from './routes/health';
import { startScheduler } from './services/scheduler.service';
```

Add route registration (after sslRoutes):
```typescript
server.register(healthRoutes, { prefix: '/api/health' });
```

Start scheduler after listen:
```typescript
await server.listen({ port: config.port, host: '0.0.0.0' });
console.log(`proxy-netmail API running on port ${config.port}`);
startScheduler(server.db);  // fire-and-forget; logs its own errors
```

---

### Stage 6 — Install node-cron types (included in Stage 0)

---

### Stage 7 — Web component: health-status-badge.tsx
**File:** `apps/web/src/components/health/health-status-badge.tsx` (new)

Props: `{ status: HealthStatus | null; label?: string }`

Status color mapping:
- `'ok'` → `bg-green-100 text-green-800`
- `'timeout' | 'refused'` → `bg-orange-100 text-orange-800`
- `'ssl_error' | 'auth_error' | 'unknown'` → `bg-red-100 text-red-800`
- `null` → `bg-gray-100 text-gray-500`, display `—`

Renders: `{label}: {status}` or just `{status}` if no label. Uses existing `Badge` component.

---

### Stage 8 — Web page: monitor/page.tsx
**File:** `apps/web/src/app/(dashboard)/monitor/page.tsx` (new, 'use client')

Nav item `/monitor` already exists in dashboard layout — just needs the page file.

State: `summaries: HealthSummary[]`, `accounts: Account[]`, `checking: Record<number, boolean>`

Data: parallel fetch `GET /api/health` + `GET /api/accounts` on mount. Merge by `account_id`.

Summary stats bar (3 metric cards):
- Healthy = all 3 protocols 'ok'
- Degraded = at least one non-ok
- Failed = all 3 null/failed

Account grid (2-3 col responsive):
- Per-account Card: label, domain, 3x `HealthStatusBadge` (IMAP/SMTP/POP3), last_checked time, "Run Check" button
- "Run Check" → `POST /api/health/:id/check`, updates summary in-place (no full reload)
- `checking[id]` state disables button + shows "Checking..."
- Empty state: "No accounts configured" card
- Never-checked: badges show gray `—`, "Never checked" text

---

### Stage 9 — Add Health tab to account detail page
**File:** `apps/web/src/app/(dashboard)/accounts/[id]/page.tsx` (edit)

Three changes:
1. Add `'health'` to tab type, add state: `healthHistory`, `healthSummary`, `healthLoading`, `runningCheck`
2. Add `useEffect` (fires when `activeTab === 'health'`): fetch `GET /api/health/:id` (history) + `GET /api/health` (all summaries, filter by accountId)
3. Add Health tab button + tab content:
   - 3x `HealthStatusBadge` for current summary
   - "Run Health Check" button → `POST /api/health/:id/check`, refreshes summary + history
   - History table: time, protocol, status badge, latency, error_detail (last 10 rows)
   - Empty state: "No checks yet."

Add imports: `HealthCheck`, `HealthSummary` from `@proxy-netmail/shared`; `HealthStatusBadge` from components.

---

## Key Decisions
- **TCP probe (not TLS)** — proves NGINX stream proxy is accepting connections at the right level
- **Probed ports: 993/465/995** — the SSL ports NGINX exposes, not the upstream ports
- **EventEmitter for SSE** — exported from health.service.ts, keyed `check:${accountId}`, avoids circular deps
- **No SSE on monitor page** — polls on load, updates on manual trigger; SSE available on account detail if needed
- **node-cron** (not setInterval) — proper cron expression, supports future schedule config; interval read once at startup
- **Scheduler errors silenced per-account** — one failed probe never stops the batch; all logged to console

## Verification
1. `pnpm --filter @proxy-netmail/api add node-cron` installs without error
2. API starts; console logs `[Scheduler] Health checks scheduled every 5 minutes`
3. `POST /api/health/:id/check` returns `HealthSummary` with imap/smtp/pop3 fields
4. `GET /api/health` returns array of summaries
5. `GET /api/health/:id` returns array of HealthCheck records
6. `/monitor` page loads with account health cards
7. "Run Check" button updates badges in-place without page reload
8. Account detail `/accounts/:id` Health tab shows protocol badges + history table
9. On Windows dev: TCP probes to mail ports fail with refused/timeout — correctly recorded
