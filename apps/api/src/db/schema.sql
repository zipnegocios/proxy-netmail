CREATE TABLE IF NOT EXISTS accounts (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  label           VARCHAR(100) NOT NULL,
  target_domain   VARCHAR(255) NOT NULL UNIQUE,
  imap_upstream   VARCHAR(255) DEFAULT 'imap.hostinger.com',
  smtp_upstream   VARCHAR(255) DEFAULT 'smtp.hostinger.com',
  pop_upstream    VARCHAR(255) DEFAULT 'pop.hostinger.com',
  imap_port       INT DEFAULT 993,
  smtp_port       INT DEFAULT 465,
  pop_port        INT DEFAULT 995,
  proxy_status    ENUM('pending','running','stopped','error') DEFAULT 'pending',
  nginx_conf_path VARCHAR(255),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ssl_certificates (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  account_id      INT NOT NULL,
  domain          VARCHAR(255) NOT NULL,
  issued_at       DATETIME,
  expires_at      DATETIME,
  status          ENUM('pending','active','expiring_soon','expired','error') DEFAULT 'pending',
  cert_path       VARCHAR(255),
  key_path        VARCHAR(255),
  last_renewed_at DATETIME,
  error_message   TEXT,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS health_checks (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  account_id      INT NOT NULL,
  protocol        ENUM('imap','smtp','pop3') NOT NULL,
  status          ENUM('ok','timeout','refused','ssl_error','auth_error','unknown') NOT NULL,
  latency_ms      INT,
  checked_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  error_detail    TEXT,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activity_log (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  account_id      INT,
  event_type      ENUM('setup','ssl_issue','ssl_renew','proxy_start','proxy_stop',
                       'health_fail','health_ok','dns_check','config_update',
                       'diagnose','alert','manual_action') NOT NULL,
  severity        ENUM('info','warn','error','success') DEFAULT 'info',
  message         TEXT NOT NULL,
  metadata        JSON,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS diagnostics (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  account_id      INT,
  triggered_by    ENUM('manual','scheduled','auto_alert') DEFAULT 'manual',
  report          JSON NOT NULL,
  summary         TEXT,
  issues_found    INT DEFAULT 0,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS system_config (
  key_name        VARCHAR(100) PRIMARY KEY,
  value           TEXT,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO system_config (key_name, value) VALUES
  ('health_check_interval_minutes', '5'),
  ('ssl_renew_threshold_days', '14'),
  ('alert_email', ''),
  ('nginx_sites_path', '/etc/nginx/conf.d'),
  ('certbot_webroot', '/var/www/certbot');
