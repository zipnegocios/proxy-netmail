import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { Account, CreateAccountDto, UpdateAccountDto } from '@proxy-netmail/shared';

interface AccountRow extends RowDataPacket, Account {}

export async function findAll(db: Pool): Promise<Account[]> {
  const [rows] = await db.execute<AccountRow[]>(
    'SELECT * FROM accounts ORDER BY created_at DESC',
  );
  return rows;
}

export async function findById(db: Pool, id: number): Promise<Account | null> {
  const [rows] = await db.execute<AccountRow[]>(
    'SELECT * FROM accounts WHERE id = ?',
    [id],
  );
  return rows[0] || null;
}

export async function create(db: Pool, dto: CreateAccountDto): Promise<Account> {
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO accounts (label, target_domain, imap_upstream, smtp_upstream, pop_upstream, imap_port, smtp_port, pop_port)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      dto.label,
      dto.target_domain,
      dto.imap_upstream || 'imap.hostinger.com',
      dto.smtp_upstream || 'smtp.hostinger.com',
      dto.pop_upstream || 'pop.hostinger.com',
      dto.imap_port || 993,
      dto.smtp_port || 465,
      dto.pop_port || 995,
    ],
  );
  return (await findById(db, result.insertId))!;
}

export async function update(
  db: Pool,
  id: number,
  dto: UpdateAccountDto,
): Promise<Account | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (dto.label !== undefined) { fields.push('label = ?'); values.push(dto.label); }
  if (dto.target_domain !== undefined) { fields.push('target_domain = ?'); values.push(dto.target_domain); }
  if (dto.imap_upstream !== undefined) { fields.push('imap_upstream = ?'); values.push(dto.imap_upstream); }
  if (dto.smtp_upstream !== undefined) { fields.push('smtp_upstream = ?'); values.push(dto.smtp_upstream); }
  if (dto.pop_upstream !== undefined) { fields.push('pop_upstream = ?'); values.push(dto.pop_upstream); }
  if (dto.imap_port !== undefined) { fields.push('imap_port = ?'); values.push(dto.imap_port); }
  if (dto.smtp_port !== undefined) { fields.push('smtp_port = ?'); values.push(dto.smtp_port); }
  if (dto.pop_port !== undefined) { fields.push('pop_port = ?'); values.push(dto.pop_port); }

  if (fields.length === 0) return findById(db, id);

  values.push(id);
  await db.execute<ResultSetHeader>(
    `UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
  return findById(db, id);
}

export async function remove(db: Pool, id: number): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    'DELETE FROM accounts WHERE id = ?',
    [id],
  );
  return result.affectedRows > 0;
}
