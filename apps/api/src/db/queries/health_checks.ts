import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { HealthCheck, HealthSummary } from '@proxy-netmail/shared';

export async function insert(
  pool: Pool,
  check: Omit<HealthCheck, 'id' | 'checked_at'>,
): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO health_checks (account_id, protocol, status, latency_ms, error_detail) VALUES (?, ?, ?, ?, ?)',
    [
      check.account_id,
      check.protocol,
      check.status,
      check.latency_ms,
      check.error_detail,
    ],
  );
  return result.insertId;
}

export async function findByAccount(
  pool: Pool,
  accountId: number,
  limit: number = 50,
): Promise<HealthCheck[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id, account_id, protocol, status, latency_ms, checked_at, error_detail FROM health_checks WHERE account_id = ? ORDER BY checked_at DESC LIMIT ?',
    [accountId, limit],
  );

  return rows.map((row) => ({
    id: row.id,
    account_id: row.account_id,
    protocol: row.protocol,
    status: row.status,
    latency_ms: row.latency_ms,
    checked_at: new Date(row.checked_at).toISOString(),
    error_detail: row.error_detail,
  }));
}

export async function findSummaryByAccount(
  pool: Pool,
  accountId: number,
): Promise<HealthSummary | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT
      h.account_id,
      MAX(h.checked_at) AS last_checked,
      MAX(CASE WHEN h.protocol = 'imap' AND h.checked_at = (SELECT MAX(checked_at) FROM health_checks WHERE account_id = ? AND protocol = 'imap') THEN h.status END) AS imap,
      MAX(CASE WHEN h.protocol = 'smtp' AND h.checked_at = (SELECT MAX(checked_at) FROM health_checks WHERE account_id = ? AND protocol = 'smtp') THEN h.status END) AS smtp,
      MAX(CASE WHEN h.protocol = 'pop3' AND h.checked_at = (SELECT MAX(checked_at) FROM health_checks WHERE account_id = ? AND protocol = 'pop3') THEN h.status END) AS pop3
     FROM health_checks h
     WHERE h.account_id = ?
     GROUP BY h.account_id`,
    [accountId, accountId, accountId, accountId],
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    account_id: row.account_id,
    imap: row.imap ?? null,
    smtp: row.smtp ?? null,
    pop3: row.pop3 ?? null,
    last_checked: row.last_checked
      ? new Date(row.last_checked).toISOString()
      : null,
  };
}

export async function findAllSummaries(pool: Pool): Promise<HealthSummary[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT
      h.account_id,
      MAX(h.checked_at) AS last_checked,
      MAX(CASE WHEN h.protocol = 'imap' AND h.checked_at = (SELECT MAX(h2.checked_at) FROM health_checks h2 WHERE h2.account_id = h.account_id AND h2.protocol = 'imap') THEN h.status END) AS imap,
      MAX(CASE WHEN h.protocol = 'smtp' AND h.checked_at = (SELECT MAX(h2.checked_at) FROM health_checks h2 WHERE h2.account_id = h.account_id AND h2.protocol = 'smtp') THEN h.status END) AS smtp,
      MAX(CASE WHEN h.protocol = 'pop3' AND h.checked_at = (SELECT MAX(h2.checked_at) FROM health_checks h2 WHERE h2.account_id = h.account_id AND h2.protocol = 'pop3') THEN h.status END) AS pop3
     FROM health_checks h
     GROUP BY h.account_id`,
  );

  return rows.map((row) => ({
    account_id: row.account_id,
    imap: row.imap ?? null,
    smtp: row.smtp ?? null,
    pop3: row.pop3 ?? null,
    last_checked: row.last_checked
      ? new Date(row.last_checked).toISOString()
      : null,
  }));
}
