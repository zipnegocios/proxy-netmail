import net from 'net';
import { EventEmitter } from 'events';
import { Pool, RowDataPacket } from 'mysql2/promise';
import type { HealthCheck, HealthSummary, Protocol, HealthStatus } from '@proxy-netmail/shared';
import * as healthQueries from '../db/queries/health_checks';
import * as accountQueries from '../db/queries/accounts';
import * as activityLog from '../db/queries/activity_log';

export const healthEmitter = new EventEmitter();
healthEmitter.setMaxListeners(0);

export async function probePort(
  host: string,
  port: number,
  timeoutMs: number,
): Promise<{ ok: boolean; latency_ms: number | null; error?: string }> {
  return new Promise((resolve) => {
    try {
      const start = Date.now();
      const socket = net.createConnection({ host, port });

      socket.setTimeout(timeoutMs);

      const cleanup = () => {
        socket.destroy();
      };

      socket.on('connect', () => {
        cleanup();
        resolve({
          ok: true,
          latency_ms: Date.now() - start,
        });
      });

      socket.on('error', (err: any) => {
        cleanup();
        resolve({
          ok: false,
          latency_ms: null,
          error: err.message,
        });
      });

      socket.on('timeout', () => {
        cleanup();
        resolve({
          ok: false,
          latency_ms: null,
          error: 'Connection timed out',
        });
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      resolve({
        ok: false,
        latency_ms: null,
        error: errorMsg,
      });
    }
  });
}

export async function checkAccount(
  pool: Pool,
  accountId: number,
): Promise<HealthSummary> {
  const account = await accountQueries.findById(pool, accountId);
  if (!account) {
    throw new Error(`Account ${accountId} not found`);
  }

  const probes: Array<{ protocol: Protocol; port: number }> = [
    { protocol: 'imap', port: 993 },
    { protocol: 'smtp', port: 465 },
    { protocol: 'pop3', port: 995 },
  ];

  const results: Array<{
    protocol: Protocol;
    status: HealthStatus;
    latency_ms: number | null;
    error: string | null;
  }> = [];

  for (const probe of probes) {
    const result = await probePort(account.target_domain, probe.port, 5000);

    let status: HealthStatus = 'unknown';
    if (result.ok) {
      status = 'ok';
    } else if (result.error?.includes('ECONNREFUSED')) {
      status = 'refused';
    } else if (
      result.error?.includes('timed out') ||
      result.error?.includes('timeout')
    ) {
      status = 'timeout';
    }

    results.push({
      protocol: probe.protocol,
      status,
      latency_ms: result.latency_ms,
      error: result.error ?? null,
    });

    // Insert this check
    const insertedId = await healthQueries.insert(pool, {
      account_id: accountId,
      protocol: probe.protocol,
      status,
      latency_ms: result.latency_ms,
      error_detail: result.error ?? null,
    });

    // Emit for SSE
    const check: HealthCheck = {
      id: insertedId,
      account_id: accountId,
      protocol: probe.protocol,
      status,
      latency_ms: result.latency_ms,
      checked_at: new Date().toISOString(),
      error_detail: result.error ?? null,
    };
    healthEmitter.emit(`check:${accountId}`, check);
  }

  // Determine overall status for logging
  const hasOk = results.some((r) => r.status === 'ok');
  const hasFailure = results.some((r) => r.status !== 'ok');

  const messageLines = results.map(
    (r) =>
      `${r.protocol.toUpperCase()} ${r.status}${r.latency_ms ? ` (${r.latency_ms}ms)` : ''}`,
  );
  const message = `Health check: ${messageLines.join(', ')}`;

  const eventType = hasFailure ? 'health_fail' : 'health_ok';
  const severity = hasOk ? (hasFailure ? 'warn' : 'success') : 'error';

  await activityLog.insert(pool, {
    account_id: accountId,
    event_type: eventType,
    severity,
    message,
  });

  // Return updated summary
  const summary = await healthQueries.findSummaryByAccount(pool, accountId);
  if (!summary) {
    throw new Error('Failed to retrieve health summary after insert');
  }

  return summary;
}
