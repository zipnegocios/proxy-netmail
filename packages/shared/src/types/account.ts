export interface Account {
  id: number;
  label: string;
  target_domain: string;
  imap_upstream: string;
  smtp_upstream: string;
  pop_upstream: string;
  imap_port: number;
  smtp_port: number;
  pop_port: number;
  proxy_status: 'pending' | 'running' | 'stopped' | 'error';
  nginx_conf_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAccountDto {
  label: string;
  target_domain: string;
  imap_upstream?: string;
  smtp_upstream?: string;
  pop_upstream?: string;
  imap_port?: number;
  smtp_port?: number;
  pop_port?: number;
}

export interface UpdateAccountDto extends Partial<CreateAccountDto> {}
