import { promises as dns } from 'dns';

export async function checkDns(
  domain: string,
): Promise<{ ok: boolean; ip: string | null; message: string }> {
  try {
    const address = await dns.lookup(domain);
    return {
      ok: true,
      ip: address.address,
      message: `Domain resolves to ${address.address}`,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown DNS error';
    return {
      ok: false,
      ip: null,
      message: `DNS lookup failed: ${message}`,
    };
  }
}
