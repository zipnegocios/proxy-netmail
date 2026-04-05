import { readFileSync } from 'fs';
import { resolve } from 'path';
import pool from './connection';

async function migrate() {
  const schemaPath = resolve(__dirname, 'schema.sql');
  const sql = readFileSync(schemaPath, 'utf-8');

  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`Running ${statements.length} migration statements...`);

  for (const statement of statements) {
    const preview = statement.substring(0, 60).replace(/\n/g, ' ');
    try {
      await pool.execute(statement);
      console.log(`  ✓ ${preview}...`);
    } catch (err: any) {
      console.error(`  ✗ ${preview}...`);
      console.error(`    Error: ${err.message}`);
      throw err;
    }
  }

  console.log('Migration completed successfully.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
