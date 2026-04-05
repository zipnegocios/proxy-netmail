import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Account } from '@proxy-netmail/shared';
import { config } from '../config';

const execAsync = promisify(exec);

interface SslPaths {
  cert: string;
  key: string;
}

function safeDomain(domain: string): string {
  return domain.replace(/[^a-zA-Z0-9.-]/g, '_');
}

export function generateConfig(account: Account, ssl: SslPaths): string {
  const safe = safeDomain(account.target_domain);
  const timestamp = new Date().toISOString();

  return `# proxy-netmail: ${account.label} (${account.target_domain})
# Generated: ${timestamp}
# DO NOT EDIT MANUALLY — managed by proxy-netmail

# IMAP Proxy
upstream imap_${safe} {
    server ${account.imap_upstream}:${account.imap_port};
}

server {
    listen 993 ssl;
    proxy_pass imap_${safe};

    ssl_certificate     ${ssl.cert};
    ssl_certificate_key ${ssl.key};
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    proxy_timeout       300s;
    proxy_connect_timeout 10s;
}

# SMTP Proxy
upstream smtp_${safe} {
    server ${account.smtp_upstream}:${account.smtp_port};
}

server {
    listen 465 ssl;
    proxy_pass smtp_${safe};

    ssl_certificate     ${ssl.cert};
    ssl_certificate_key ${ssl.key};
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    proxy_timeout       300s;
    proxy_connect_timeout 10s;
}

# POP3 Proxy
upstream pop3_${safe} {
    server ${account.pop_upstream}:${account.pop_port};
}

server {
    listen 995 ssl;
    proxy_pass pop3_${safe};

    ssl_certificate     ${ssl.cert};
    ssl_certificate_key ${ssl.key};
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    proxy_timeout       300s;
    proxy_connect_timeout 10s;
}
`;
}

export async function writeConfig(account: Account, configContent: string): Promise<string> {
  const filename = `proxy-netmail-${safeDomain(account.target_domain)}.conf`;
  const filePath = join(config.nginxSitesPath, filename);

  if (!existsSync(config.nginxSitesPath)) {
    await mkdir(config.nginxSitesPath, { recursive: true });
  }

  await writeFile(filePath, configContent, 'utf-8');
  return filePath;
}

export async function removeConfig(confPath: string): Promise<void> {
  if (existsSync(confPath)) {
    await unlink(confPath);
  }
}

export async function validateConfig(): Promise<{ valid: boolean; error?: string }> {
  if (process.platform === 'win32') {
    console.warn('[nginx] Skipping nginx -t on Windows');
    return { valid: true };
  }

  try {
    await execAsync('nginx -t 2>&1');
    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: err.stderr || err.message };
  }
}

export async function reloadNginx(): Promise<{ success: boolean; error?: string }> {
  if (process.platform === 'win32') {
    console.warn('[nginx] Skipping nginx reload on Windows');
    return { success: true };
  }

  try {
    await execAsync('nginx -s reload');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.stderr || err.message };
  }
}
