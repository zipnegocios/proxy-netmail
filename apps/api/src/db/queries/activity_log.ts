import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { ActivityLogEntry } from '@proxy-netmail/shared';

export async function insert(
  pool: Pool,
  entry: Omit<ActivityLogEntry, 'id' | 'created_at'>,
): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO activity_log (account_id, event_type, severity, message, metadata) VALUES (?, ?, ?, ?, ?)',
    [
      entry.account_id,
      entry.event_type,
      entry.severity,
      entry.message,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
    ],
  );
  return result.insertId;
}

export async function findByAccount(
  pool: Pool,
  accountId: number,
  limit = 50,
): Promise<ActivityLogEntry[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id, account_id, event_type, severity, message, metadata, created_at FROM activity_log WHERE account_id = ? ORDER BY created_at DESC LIMIT ?',
    [accountId, limit],
  );

  return rows.map((row) => ({
    id: row.id,
    account_id: row.account_id,
    event_type: row.event_type,
    severity: row.severity,
    message: row.message,
    metadata:
      typeof row.metadata === 'string'
        ? JSON.parse(row.metadata)
        : row.metadata,
    created_at: row.created_at,
  }));
}

export async function findRecent(
  pool: Pool,
  limit = 50,
): Promise<ActivityLogEntry[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id, account_id, event_type, severity, message, metadata, created_at FROM activity_log ORDER BY created_at DESC LIMIT ?',
    [limit],
  );

  return rows.map((row) => ({
    id: row.id,
    account_id: row.account_id,
    event_type: row.event_type,
    severity: row.severity,
    message: row.message,
    metadata:
      typeof row.metadata === 'string'
        ? JSON.parse(row.metadata)
        : row.metadata,
    created_at: row.created_at,
  }));
}
