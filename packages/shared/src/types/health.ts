export type Protocol = 'imap' | 'smtp' | 'pop3';

export type HealthStatus = 'ok' | 'timeout' | 'refused' | 'ssl_error' | 'auth_error' | 'unknown';

export interface HealthCheck {
  id: number;
  account_id: number;
  protocol: Protocol;
  status: HealthStatus;
  latency_ms: number | null;
  checked_at: string;
  error_detail: string | null;
}

export interface HealthSummary {
  account_id: number;
  imap: HealthStatus | null;
  smtp: HealthStatus | null;
  pop3: HealthStatus | null;
  last_checked: string | null;
}
