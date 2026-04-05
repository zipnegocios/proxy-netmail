import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { SystemConfig } from '@proxy-netmail/shared';

interface ConfigRow extends RowDataPacket, SystemConfig {}

export async function getAll(db: Pool): Promise<SystemConfig[]> {
  const [rows] = await db.execute<ConfigRow[]>(
    'SELECT * FROM system_config ORDER BY key_name',
  );
  return rows;
}

export async function getByKey(db: Pool, key: string): Promise<SystemConfig | null> {
  const [rows] = await db.execute<ConfigRow[]>(
    'SELECT * FROM system_config WHERE key_name = ?',
    [key],
  );
  return rows[0] || null;
}

export async function upsert(db: Pool, key: string, value: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    `INSERT INTO system_config (key_name, value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value)`,
    [key, value],
  );
}
