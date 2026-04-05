import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function issueCert(
  domain: string,
  email: string,
): Promise<{
  ok: boolean;
  certPath: string | null;
  keyPath: string | null;
  error?: string;
}> {
  // Windows dev mode: simulate cert issuance
  if (process.platform === 'win32') {
    console.log(
      `[Certbot-Sim] Windows dev mode: skipping certbot for ${domain}`,
    );
    return {
      ok: true,
      certPath: `/etc/letsencrypt/live/${domain}/fullchain.pem`,
      keyPath: `/etc/letsencrypt/live/${domain}/privkey.pem`,
    };
  }

  try {
    const command = `certbot certonly --standalone -d ${domain} --email ${email} --agree-tos --non-interactive`;
    console.log(`[Certbot] Running: ${command}`);
    await execAsync(command);

    return {
      ok: true,
      certPath: `/etc/letsencrypt/live/${domain}/fullchain.pem`,
      keyPath: `/etc/letsencrypt/live/${domain}/privkey.pem`,
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : 'Unknown certbot error';
    console.error(`[Certbot] Error: ${errorMsg}`);
    return {
      ok: false,
      certPath: null,
      keyPath: null,
      error: errorMsg,
    };
  }
}
