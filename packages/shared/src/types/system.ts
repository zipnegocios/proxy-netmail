export interface SystemConfig {
  key_name: string;
  value: string;
  updated_at: string;
}

export type EventType =
  | 'setup'
  | 'ssl_issue'
  | 'ssl_renew'
  | 'proxy_start'
  | 'proxy_stop'
  | 'health_fail'
  | 'health_ok'
  | 'dns_check'
  | 'config_update'
  | 'diagnose'
  | 'alert'
  | 'manual_action';

export type Severity = 'info' | 'warn' | 'error' | 'success';

export interface ActivityLogEntry {
  id: number;
  account_id: number | null;
  event_type: EventType;
  severity: Severity;
  message: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface SslCertificate {
  id: number;
  account_id: number;
  domain: string;
  issued_at: string | null;
  expires_at: string | null;
  status: 'pending' | 'active' | 'expiring_soon' | 'expired' | 'error';
  cert_path: string | null;
  key_path: string | null;
  last_renewed_at: string | null;
  error_message: string | null;
}

export interface DiagnosticReport {
  id: number;
  account_id: number | null;
  triggered_by: 'manual' | 'scheduled' | 'auto_alert';
  report: DiagnosticCheck[];
  summary: string | null;
  issues_found: number;
  created_at: string;
}

export interface DiagnosticCheck {
  id: string;
  status: 'ok' | 'warning' | 'error';
  detail: string;
}

export interface SetupEvent {
  step: number;
  stepName: string;
  status: 'running' | 'success' | 'error' | 'done';
  message: string;
  metadata?: Record<string, unknown>;
}
