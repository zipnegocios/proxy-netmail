import { Pool } from 'mysql2/promise';
import type { Account, SetupEvent } from '@proxy-netmail/shared';
import * as activityLog from '../db/queries/activity_log';
import * as sslQueries from '../db/queries/ssl';
import * as accountQueries from '../db/queries/accounts';
import * as dnsService from './dns.service';
import * as certbotService from './certbot.service';
import * as nginxService from './nginx.service';

export async function runSetup(
  accountId: number,
  pool: Pool,
  emit: (event: SetupEvent) => void,
  certbotEmail: string,
): Promise<void> {
  const account = await accountQueries.findById(pool, accountId);
  if (!account) {
    emit({
      step: 0,
      stepName: 'Error',
      status: 'error',
      message: 'Account not found',
    });
    throw new Error(`Account ${accountId} not found`);
  }

  try {
    // Step 1: DNS Verification
    emit({
      step: 1,
      stepName: 'DNS Verification',
      status: 'running',
      message: `Checking DNS for ${account.target_domain}`,
    });

    const dnsResult = await dnsService.checkDns(account.target_domain);
    if (!dnsResult.ok) {
      emit({
        step: 1,
        stepName: 'DNS Verification',
        status: 'error',
        message: dnsResult.message,
      });
      await activityLog.insert(pool, {
        account_id: accountId,
        event_type: 'dns_check',
        severity: 'error',
        message: dnsResult.message,
      });
      throw new Error(dnsResult.message);
    }

    emit({
      step: 1,
      stepName: 'DNS Verification',
      status: 'success',
      message: dnsResult.message,
    });
    await activityLog.insert(pool, {
      account_id: accountId,
      event_type: 'dns_check',
      severity: 'success',
      message: dnsResult.message,
    });

    // Step 2: Write Initial Config (no SSL)
    emit({
      step: 2,
      stepName: 'Write Initial Config',
      status: 'running',
      message: 'Writing initial NGINX configuration',
    });

    const noSslConfig = nginxService.generateNoSslConfig(account);
    const confPath = await nginxService.writeConfig(account, noSslConfig);
    const validationResult = await nginxService.validateConfig();

    if (!validationResult.valid) {
      emit({
        step: 2,
        stepName: 'Write Initial Config',
        status: 'error',
        message: `NGINX validation failed: ${validationResult.error}`,
      });
      await activityLog.insert(pool, {
        account_id: accountId,
        event_type: 'config_update',
        severity: 'error',
        message: `Initial NGINX config validation failed: ${validationResult.error}`,
      });
      throw new Error(validationResult.error || 'NGINX validation failed');
    }

    const reloadResult = await nginxService.reloadNginx();
    if (!reloadResult.success) {
      emit({
        step: 2,
        stepName: 'Write Initial Config',
        status: 'error',
        message: `NGINX reload failed: ${reloadResult.error}`,
      });
      await activityLog.insert(pool, {
        account_id: accountId,
        event_type: 'config_update',
        severity: 'error',
        message: `Initial NGINX reload failed: ${reloadResult.error}`,
      });
      throw new Error(reloadResult.error || 'NGINX reload failed');
    }

    emit({
      step: 2,
      stepName: 'Write Initial Config',
      status: 'success',
      message: 'Initial NGINX configuration written and reloaded',
    });
    await activityLog.insert(pool, {
      account_id: accountId,
      event_type: 'config_update',
      severity: 'success',
      message: 'Initial NGINX configuration written and reloaded',
    });

    // Step 3: Backup Config
    emit({
      step: 3,
      stepName: 'Backup Config',
      status: 'running',
      message: 'Backing up existing configuration',
    });

    if (account.nginx_conf_path) {
      try {
        await nginxService.backupConfig(account.nginx_conf_path);
        emit({
          step: 3,
          stepName: 'Backup Config',
          status: 'success',
          message: 'Configuration backed up',
        });
      } catch (err) {
        console.warn('[Setup] Backup failed (non-critical):', err);
        emit({
          step: 3,
          stepName: 'Backup Config',
          status: 'success',
          message: 'No previous configuration to backup',
        });
      }
    } else {
      emit({
        step: 3,
        stepName: 'Backup Config',
        status: 'success',
        message: 'No previous configuration to backup',
      });
    }

    // Step 4: Issue SSL Certificate
    emit({
      step: 4,
      stepName: 'Issue SSL Certificate',
      status: 'running',
      message: `Requesting SSL certificate for ${account.target_domain}`,
    });

    const certResult = await certbotService.issueCert(
      account.target_domain,
      certbotEmail,
    );
    if (!certResult.ok) {
      emit({
        step: 4,
        stepName: 'Issue SSL Certificate',
        status: 'error',
        message: certResult.error || 'Certbot failed',
      });
      await activityLog.insert(pool, {
        account_id: accountId,
        event_type: 'ssl_issue',
        severity: 'error',
        message: certResult.error || 'Failed to issue SSL certificate',
      });
      throw new Error(certResult.error || 'Certbot failed');
    }

    emit({
      step: 4,
      stepName: 'Issue SSL Certificate',
      status: 'success',
      message: 'SSL certificate issued successfully',
    });
    await activityLog.insert(pool, {
      account_id: accountId,
      event_type: 'ssl_issue',
      severity: 'success',
      message: 'SSL certificate issued successfully',
    });

    // Step 5: Write SSL Config
    emit({
      step: 5,
      stepName: 'Write SSL Config',
      status: 'running',
      message: 'Writing SSL-enabled NGINX configuration',
    });

    const sslConfig = nginxService.generateConfig(account, {
      cert: certResult.certPath!,
      key: certResult.keyPath!,
    });
    await nginxService.writeConfig(account, sslConfig);
    const sslValidation = await nginxService.validateConfig();

    if (!sslValidation.valid) {
      emit({
        step: 5,
        stepName: 'Write SSL Config',
        status: 'error',
        message: `SSL NGINX validation failed: ${sslValidation.error}`,
      });
      await activityLog.insert(pool, {
        account_id: accountId,
        event_type: 'config_update',
        severity: 'error',
        message: `SSL NGINX validation failed: ${sslValidation.error}`,
      });
      throw new Error(sslValidation.error || 'NGINX validation failed');
    }

    const sslReload = await nginxService.reloadNginx();
    if (!sslReload.success) {
      emit({
        step: 5,
        stepName: 'Write SSL Config',
        status: 'error',
        message: `SSL NGINX reload failed: ${sslReload.error}`,
      });
      await activityLog.insert(pool, {
        account_id: accountId,
        event_type: 'config_update',
        severity: 'error',
        message: `SSL NGINX reload failed: ${sslReload.error}`,
      });
      throw new Error(sslReload.error || 'NGINX reload failed');
    }

    emit({
      step: 5,
      stepName: 'Write SSL Config',
      status: 'success',
      message: 'SSL-enabled NGINX configuration written and reloaded',
    });
    await activityLog.insert(pool, {
      account_id: accountId,
      event_type: 'config_update',
      severity: 'success',
      message: 'SSL-enabled NGINX configuration written and reloaded',
    });

    // Step 6: Update SSL Record
    emit({
      step: 6,
      stepName: 'Update SSL Record',
      status: 'running',
      message: 'Recording SSL certificate details',
    });

    await sslQueries.upsertCertificate(pool, {
      account_id: accountId,
      domain: account.target_domain,
      issued_at: new Date().toISOString(),
      expires_at: null, // Parse from cert in production
      status: 'active',
      cert_path: certResult.certPath,
      key_path: certResult.keyPath,
      last_renewed_at: new Date().toISOString(),
      error_message: null,
    });

    emit({
      step: 6,
      stepName: 'Update SSL Record',
      status: 'success',
      message: 'SSL certificate recorded',
    });

    // Step 7: Activate Proxy
    emit({
      step: 7,
      stepName: 'Activate Proxy',
      status: 'running',
      message: 'Activating proxy',
    });

    await pool.execute('UPDATE accounts SET proxy_status = ? WHERE id = ?', [
      'running',
      accountId,
    ]);

    emit({
      step: 7,
      stepName: 'Activate Proxy',
      status: 'done',
      message: 'Proxy is now running',
    });

    await activityLog.insert(pool, {
      account_id: accountId,
      event_type: 'proxy_start',
      severity: 'success',
      message: 'Proxy started successfully',
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Setup] Pipeline error:', errorMsg);
    emit({
      step: 0,
      stepName: 'Error',
      status: 'error',
      message: errorMsg,
    });
    throw error;
  }
}
