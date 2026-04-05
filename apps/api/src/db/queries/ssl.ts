import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { SslCertificate } from '@proxy-netmail/shared';

export async function findByAccount(
  pool: Pool,
  accountId: number,
): Promise<SslCertificate | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id, account_id, domain, issued_at, expires_at, status, cert_path, key_path, last_renewed_at, error_message FROM ssl_certificates WHERE account_id = ? LIMIT 1',
    [accountId],
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    account_id: row.account_id,
    domain: row.domain,
    issued_at: row.issued_at,
    expires_at: row.expires_at,
    status: row.status,
    cert_path: row.cert_path,
    key_path: row.key_path,
    last_renewed_at: row.last_renewed_at,
    error_message: row.error_message,
  };
}

export async function upsertCertificate(
  pool: Pool,
  data: Omit<SslCertificate, 'id'>,
): Promise<void> {
  await pool.execute<ResultSetHeader>(
    `INSERT INTO ssl_certificates (account_id, domain, issued_at, expires_at, status, cert_path, key_path, last_renewed_at, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       domain = VALUES(domain),
       issued_at = VALUES(issued_at),
       expires_at = VALUES(expires_at),
       status = VALUES(status),
       cert_path = VALUES(cert_path),
       key_path = VALUES(key_path),
       last_renewed_at = VALUES(last_renewed_at),
       error_message = VALUES(error_message)`,
    [
      data.account_id,
      data.domain,
      data.issued_at,
      data.expires_at,
      data.status,
      data.cert_path,
      data.key_path,
      data.last_renewed_at,
      data.error_message,
    ],
  );
}
