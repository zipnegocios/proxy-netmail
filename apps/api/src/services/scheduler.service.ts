import cron from 'node-cron';
import { Pool, RowDataPacket } from 'mysql2/promise';
import * as systemQueries from '../db/queries/system';
import * as healthService from './health.service';

export function startScheduler(pool: Pool): void {
  (async () => {
    try {
      // Read interval from system config
      const configRow = await systemQueries.getByKey(
        pool,
        'health_check_interval_minutes',
      );
      const intervalMinutes = configRow
        ? parseInt(configRow.value, 10)
        : 5;
      const safeInterval =
        isNaN(intervalMinutes) || intervalMinutes < 1 ? 5 : intervalMinutes;

      // Build and validate cron expression
      const cronExpr = `*/${safeInterval} * * * *`;
      if (!cron.validate(cronExpr)) {
        console.error(
          `[Scheduler] Invalid cron expression: ${cronExpr}`,
        );
        return;
      }

      // Schedule the job
      cron.schedule(cronExpr, async () => {
        await checkAllRunningAccounts(pool);
      });

      console.log(
        `[Scheduler] Health checks scheduled every ${safeInterval} minutes`,
      );
    } catch (error) {
      console.error('[Scheduler] Failed to start:', error);
    }
  })();
}

async function checkAllRunningAccounts(pool: Pool): Promise<void> {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM accounts WHERE proxy_status = ?',
      ['running'],
    );

    console.log(
      `[Scheduler] Running health checks for ${rows.length} accounts`,
    );

    for (const row of rows) {
      try {
        await healthService.checkAccount(pool, (row as any).id);
      } catch (err) {
        console.error(
          `[Scheduler] Health check failed for account ${(row as any).id}:`,
          err,
        );
      }
    }
  } catch (error) {
    console.error('[Scheduler] Failed to fetch accounts:', error);
  }
}
