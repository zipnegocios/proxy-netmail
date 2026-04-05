# Proxima — Plan de Desarrollo
### Mail Proxy & Network Management Platform
**Versión 1.0 — Para desarrollo con Claude Code (Antigravity)**

---

## 1. Nombre y concepto del producto

**Proxima** — Del latín *proximus* (cercano, próximo) y raíz de *proxy*. El nombre comunica que tu infraestructura de correo siempre está cerca, bajo control, con identidad propia.

**Tagline:** *Your domain. Your mail. Your rules.*

---

## 2. Resumen ejecutivo

Proxima es una plataforma web de gestión de proxies de correo electrónico. Permite a un administrador configurar, monitorear y corregir en tiempo real múltiples cuentas de email que utilizan servidores Hostinger como backend, exponiendo dominios propios (IMAP/SMTP/POP3) a los clientes finales.

La plataforma automatiza:
- Generación de configuración NGINX (stream proxy)
- Emisión y renovación de certificados SSL vía Certbot/Let's Encrypt
- Verificación de propagación DNS
- Health checks periódicos de cada protocolo (IMAP/SMTP/POP3)
- Diagnóstico automático y alertas de incidencias
- Renovación de SSL con un clic

---

## 3. Stack tecnológico

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend | Next.js 14 (App Router) | SSR + Client Components + SSE nativo |
| Backend API | Fastify | Liviano, rápido, ideal para shell commands + streams |
| Base de datos | MySQL (remote existente) | Sin costo adicional, ya disponible |
| Proxy engine | NGINX (stream module) | Estándar industrial, gratuito |
| SSL | Certbot + Let's Encrypt | Gratuito, automatizable |
| Comunicación RT | Server-Sent Events (SSE) | Sin WebSockets, compatible con Next.js |
| Scheduler | node-cron | Health checks y renovaciones automáticas |
| Auth | next-auth + JWT | Sesión del panel admin |
| Deployment | VPS Hostinger existente | Sin costo adicional |

---

## 4. Arquitectura del sistema

```
┌─────────────────────────────────────────────────────┐
│                   PROXIMA DASHBOARD                  │
│              (Next.js 14 — App Router)               │
│  Accounts │ Health │ Logs │ Diagnostics │ Settings   │
└─────────────────────┬───────────────────────────────┘
                      │ HTTP + SSE
┌─────────────────────▼───────────────────────────────┐
│              PROXIMA API (Fastify)                   │
│  /accounts  /setup  /health  /ssl  /diagnose  /logs  │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────┐   │
│  │ NGINX    │  │ Certbot  │  │  node-cron       │   │
│  │ Manager  │  │ Manager  │  │  (scheduler)     │   │
│  └──────────┘  └──────────┘  └─────────────────┘   │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│                  MySQL Database                      │
│  accounts │ health_checks │ ssl_certs │ activity_log │
└─────────────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│                  NGINX (stream)                      │
│  imap.dominio.com:993 → imap.hostinger.com:993      │
│  smtp.dominio.com:465 → smtp.hostinger.com:465      │
│  pop3.dominio.com:995 → pop.hostinger.com:995       │
└──────────────────────────────────────────────────────┘
```

---

## 5. Modelo de base de datos

```sql
-- Cuentas principales
CREATE TABLE accounts (
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

-- Estado de certificados SSL
CREATE TABLE ssl_certificates (
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

-- Resultados de health checks
CREATE TABLE health_checks (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  account_id      INT NOT NULL,
  protocol        ENUM('imap','smtp','pop3') NOT NULL,
  status          ENUM('ok','timeout','refused','ssl_error','auth_error','unknown') NOT NULL,
  latency_ms      INT,
  checked_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  error_detail    TEXT,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- Log de actividad y eventos del sistema
CREATE TABLE activity_log (
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

-- Diagnósticos generados
CREATE TABLE diagnostics (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  account_id      INT,
  triggered_by    ENUM('manual','scheduled','auto_alert') DEFAULT 'manual',
  report          JSON NOT NULL,
  summary         TEXT,
  issues_found    INT DEFAULT 0,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- Configuración global del sistema
CREATE TABLE system_config (
  key_name        VARCHAR(100) PRIMARY KEY,
  value           TEXT,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed inicial
INSERT INTO system_config VALUES
  ('health_check_interval_minutes', '5', NOW()),
  ('ssl_renew_threshold_days', '14', NOW()),
  ('alert_email', '', NOW()),
  ('nginx_sites_path', '/etc/nginx/conf.d', NOW()),
  ('certbot_webroot', '/var/www/certbot', NOW());
```

---

## 6. API Endpoints (Fastify)

### Cuentas
```
GET    /api/accounts              → Lista todas las cuentas con estado
POST   /api/accounts              → Crear nueva cuenta
GET    /api/accounts/:id          → Detalle de una cuenta
PUT    /api/accounts/:id          → Actualizar parámetros
DELETE /api/accounts/:id          → Eliminar cuenta y config NGINX
```

### Setup y proxy
```
POST   /api/accounts/:id/setup    → Pipeline completo (SSE stream)
POST   /api/accounts/:id/start    → Iniciar proxies (nginx reload)
POST   /api/accounts/:id/stop     → Detener proxies
POST   /api/accounts/:id/restart  → Reiniciar proxies
GET    /api/accounts/:id/config   → Ver config NGINX generada
```

### SSL
```
GET    /api/accounts/:id/ssl      → Estado del certificado
POST   /api/accounts/:id/ssl/issue    → Emitir nuevo cert
POST   /api/accounts/:id/ssl/renew    → Renovar cert existente
GET    /api/ssl/expiring          → Todos los certs próximos a vencer
```

### Health & Monitoring
```
GET    /api/accounts/:id/health   → Último health check por protocolo
POST   /api/accounts/:id/health/run   → Ejecutar health check manual
GET    /api/health/all            → Estado de todos los proxies
GET    /api/accounts/:id/latency  → Histórico de latencia (últimas 24h)
```

### Diagnóstico
```
POST   /api/accounts/:id/diagnose → Lanzar diagnóstico completo
GET    /api/accounts/:id/diagnostics → Historial de diagnósticos
GET    /api/accounts/:id/diagnostics/:diagId → Reporte específico
```

### Logs y actividad
```
GET    /api/accounts/:id/logs     → Log de actividad filtrado
GET    /api/logs                  → Log global del sistema
GET    /api/accounts/:id/logs/stream → SSE stream en tiempo real
```

### DNS
```
POST   /api/accounts/:id/dns/check   → Verificar propagación DNS
GET    /api/accounts/:id/dns/records  → Registros DNS recomendados
```

### Sistema
```
GET    /api/system/status         → Estado general del servidor
GET    /api/system/nginx          → Estado del proceso NGINX
GET    /api/system/config         → Configuración global
PUT    /api/system/config         → Actualizar configuración
POST   /api/system/nginx/reload   → Forzar recarga NGINX global
```

---

## 7. Escenarios de fallo y soluciones incorporadas

### F1 — Certificado SSL vencido o próximo a vencer
- **Detección:** Cron job diario compara `expires_at` con `NOW() + threshold_days`
- **Alerta:** Badge "Expira en N días" en el dashboard, notificación en activity_log
- **Acción en app:** Botón "Renovar SSL" ejecuta `certbot renew --cert-name dominio.com`
- **Auto-remedio:** Si `threshold_days` pasa sin acción manual, el scheduler ejecuta renovación automática

### F2 — DNS no propagado (certbot falla en validación)
- **Detección:** Certbot retorna error de challenge; la app hace `dig` para verificar propagación
- **Diagnóstico:** Muestra los registros DNS esperados vs actuales detectados
- **Solución en app:** Panel "Instrucciones DNS" con los registros exactos a configurar (A, CNAME, MX)
- **Retry:** Botón "Reintentar SSL" disponible tras corregir DNS

### F3 — Puerto bloqueado en firewall del VPS
- **Detección:** Health check intenta `nc -zv host port` — si falla, identifica el protocolo afectado
- **Diagnóstico:** Reporte indica qué puerto está cerrado y comando `ufw` para abrirlo
- **Solución en app:** Botón "Abrir puerto" ejecuta el comando con confirmación del usuario

### F4 — NGINX cae o la configuración es inválida
- **Detección:** Health check detecta conexión rechazada; `nginx -t` valida la config
- **Diagnóstico:** Muestra el error de sintaxis con línea y archivo afectado
- **Solución en app:** "Ver config", botón "Editar y aplicar" con validación previa al reload
- **Fallback:** Backup automático de la config anterior antes de cada cambio

### F5 — Hostinger cambia sus servidores upstream
- **Detección:** Health check recibe `ssl_error` o `connection_refused` hacia el upstream
- **Diagnóstico:** Diferencia entre fallo del proxy propio vs del upstream de Hostinger
- **Solución en app:** Edición inline del upstream IMAP/SMTP/POP3 con reload inmediato

### F6 — Certbot no está instalado o versión desactualizada
- **Detección:** Fase de setup verifica `certbot --version` antes de continuar
- **Diagnóstico:** Muestra versión instalada vs recomendada con comando de actualización
- **Solución en app:** Botón "Instalar/Actualizar certbot" con output en tiempo real

### F7 — Certificado wildcard vs por subdominio (conflicto)
- **Detección:** Al emitir cert, verifica si ya existe uno wildcard `*.dominio.com`
- **Lógica:** Reutiliza wildcard existente si cubre los subdominios necesarios
- **Advertencia:** Alerta si el cert emitido no cubre todos los subdominios requeridos

### F8 — VPS sin suficiente memoria/disco para NGINX
- **Detección:** Fase de setup verifica recursos del sistema antes de continuar
- **Diagnóstico:** Reporte de uso de disco, memoria y CPU disponibles
- **Umbral:** Alerta si disco < 500MB libres o RAM < 256MB disponibles

### F9 — Múltiples dominios en el mismo puerto (conflicto NGINX)
- **Detección:** Al generar config, verifica que no haya conflicto de puertos entre cuentas
- **Solución:** El sistema asigna puertos alternativos automáticamente si hay colisión
- **Documentación:** Muestra al usuario los parámetros de conexión finales con los puertos reales

### F10 — Health check de SMTP falla por autenticación
- **Detección:** Diferencia entre error de conexión TCP y error de autenticación SMTP (EHLO test)
- **Diagnóstico:** Reporta si el proxy funciona pero las credenciales del usuario son incorrectas
- **Nota:** La app no almacena credenciales de usuario, solo verifica conectividad del proxy

---

## 8. Motor de diagnóstico

Cuando se ejecuta `/api/accounts/:id/diagnose`, la app corre en secuencia:

```
[1] Verificar proceso NGINX activo
[2] Validar sintaxis de config NGINX del dominio
[3] Verificar que los puertos 993/465/995 están escuchando
[4] Test de conexión TCP a cada puerto local
[5] Test SSL: verificar cert propio válido y no vencido
[6] Test de conexión TCP al upstream Hostinger
[7] Test SSL del upstream Hostinger
[8] Verificar propagación DNS (imap/smtp/pop3.dominio.com)
[9] Calcular latencia proxy vs directo a Hostinger
[10] Verificar fecha de vencimiento del cert y alertar si < threshold
[11] Verificar backup de config existente
[12] Generar reporte JSON con severidad por ítem
```

El reporte tiene este formato:
```json
{
  "domain": "extralimpio.com",
  "timestamp": "2025-04-05T10:22:00Z",
  "overall": "warning",
  "issues": 1,
  "checks": [
    { "id": "nginx_running",   "status": "ok",      "detail": "NGINX activo (PID 1234)" },
    { "id": "nginx_config",    "status": "ok",      "detail": "Sintaxis válida" },
    { "id": "port_993",        "status": "ok",      "detail": "Escuchando en 0.0.0.0:993" },
    { "id": "ssl_valid",       "status": "warning", "detail": "Vence en 12 días" },
    { "id": "upstream_imap",   "status": "ok",      "detail": "imap.hostinger.com:993 OK (34ms)" },
    { "id": "dns_imap",        "status": "ok",      "detail": "imap.extralimpio.com → 185.x.x.x ✓" },
    { "id": "latency_proxy",   "status": "ok",      "detail": "2ms overhead vs directo" }
  ],
  "actions_available": ["renew_ssl"]
}
```

---

## 9. Vistas del dashboard

### 9.1 Vista principal — Overview
- Métricas: total cuentas / proxies activos / certs vigentes / próxima renovación
- Lista de cuentas con estado visual por protocolo
- Alertas activas en banner superior

### 9.2 Vista de cuenta — Detail
- Configuración cliente final (imap/smtp/pop3.dominio.com con puertos)
- Estado SSL con días restantes y botón de renovación
- Health check en tiempo real de cada protocolo con latencia
- Gráfica de latencia últimas 24h
- Log de actividad de la cuenta
- Botones de acción: Diagnosticar / Reiniciar / Editar / Eliminar

### 9.3 Vista de diagnóstico
- Timeline visual de los 12 checks con semáforo
- Detalle expandible por check
- Acciones correctivas disponibles por cada problema detectado
- Botón "Exportar reporte"

### 9.4 Vista de monitoreo global
- Tabla de todos los health checks agrupada por protocolo
- Filtros: solo errores / por dominio / por protocolo
- Refresh automático cada 30 segundos o SSE push

### 9.5 Vista de SSL
- Lista de todos los certificados ordenados por fecha de vencimiento
- Indicadores: verde (>30d) / amarillo (8-30d) / rojo (<7d)
- Botón renovar individual o "Renovar todos los próximos a vencer"

### 9.6 Vista de logs
- Timeline de eventos con severidad (info/warn/error/success)
- Filtros: por cuenta / por tipo de evento / por fecha
- Exportar a CSV

### 9.7 Configuración de sistema
- Ruta de NGINX configs
- Umbral de días para alerta SSL
- Intervalo de health checks (default 5 min)
- Email de alertas
- Estado del cron scheduler

---

## 10. Estructura del proyecto

```
proxima/
├── apps/
│   ├── web/                          # Next.js 14
│   │   ├── app/
│   │   │   ├── (auth)/login/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── page.tsx          # Overview
│   │   │   │   ├── accounts/
│   │   │   │   │   ├── page.tsx      # Lista
│   │   │   │   │   └── [id]/
│   │   │   │   │       ├── page.tsx  # Detalle
│   │   │   │   │       ├── diagnose/
│   │   │   │   │       ├── logs/
│   │   │   │   │       └── ssl/
│   │   │   │   ├── monitor/page.tsx  # Health global
│   │   │   │   ├── ssl/page.tsx      # Certs overview
│   │   │   │   └── settings/page.tsx
│   │   │   └── api/
│   │   │       └── auth/[...nextauth]/
│   │   └── components/
│   │       ├── accounts/
│   │       ├── health/
│   │       ├── diagnostics/
│   │       ├── ssl/
│   │       └── ui/
│   │
│   └── api/                          # Fastify
│       ├── src/
│       │   ├── routes/
│       │   │   ├── accounts.ts
│       │   │   ├── health.ts
│       │   │   ├── ssl.ts
│       │   │   ├── diagnostics.ts
│       │   │   ├── logs.ts
│       │   │   └── system.ts
│       │   ├── services/
│       │   │   ├── nginx.service.ts   # Genera y aplica configs
│       │   │   ├── certbot.service.ts # Emite y renueva certs
│       │   │   ├── health.service.ts  # TCP + SSL checks
│       │   │   ├── dns.service.ts     # Verifica propagación
│       │   │   ├── diagnose.service.ts
│       │   │   └── scheduler.service.ts
│       │   ├── db/
│       │   │   ├── connection.ts
│       │   │   └── queries/
│       │   └── server.ts
│       └── templates/
│           └── nginx-stream.conf.tpl  # Template de config NGINX
│
├── packages/
│   └── shared/                       # Tipos compartidos TS
│       └── types/
│           ├── account.ts
│           ├── health.ts
│           └── diagnostic.ts
│
└── docker-compose.yml                # Para desarrollo local
```

---

## 11. Plan de desarrollo por fases

### Fase 1 — Fundación (Semana 1)
- [ ] Inicializar monorepo con pnpm workspaces
- [ ] Setup Fastify con MySQL connection pool
- [ ] Esquema de base de datos completo + migrations
- [ ] CRUD básico de cuentas (`/api/accounts`)
- [ ] Template de configuración NGINX (stream)
- [ ] Servicio de generación de config NGINX
- [ ] Ruta de autenticación básica (next-auth)
- [ ] Layout del dashboard en Next.js

### Fase 2 — Pipeline de setup (Semana 2)
- [ ] Servicio Certbot (issue + renew)
- [ ] Endpoint SSE para setup en tiempo real
- [ ] Verificación de DNS pre-certbot
- [ ] Barra de progreso del pipeline en el frontend
- [ ] Logs de actividad en DB
- [ ] Vista de detalle de cuenta
- [ ] Backup automático de configs NGINX

### Fase 3 — Health & Monitoring (Semana 3)
- [ ] Servicio de health check (TCP + SSL + latencia) por protocolo
- [ ] Cron job con node-cron (intervalo configurable)
- [ ] SSE stream de logs en tiempo real
- [ ] Vista de monitoreo global
- [ ] Gráfica de latencia histórica
- [ ] Vista de certs SSL con alertas

### Fase 4 — Diagnóstico y remediación (Semana 4)
- [ ] Motor de diagnóstico completo (12 checks)
- [ ] Reporte JSON + vista visual de diagnóstico
- [ ] Acciones correctivas por cada escenario de fallo (F1–F10)
- [ ] Renovación SSL con un clic
- [ ] Apertura de puertos desde el dashboard
- [ ] Edición de parámetros upstream con reload

### Fase 5 — Producción (Semana 5)
- [ ] Script de instalación en VPS (setup.sh)
- [ ] Configuración de systemd para la API Fastify
- [ ] Variables de entorno + secrets management
- [ ] Rate limiting en API
- [ ] Logs de acceso y errores
- [ ] Documentación de uso
- [ ] Testing E2E de los flujos críticos

---

## 12. Comandos para Claude Code

### Iniciar el proyecto
```bash
# Desde el directorio raíz del proyecto con Claude Code
mkdir proxima && cd proxima
pnpm init
pnpm add -w typescript @types/node

# Workspace apps
mkdir -p apps/web apps/api packages/shared
```

### Variables de entorno requeridas
```env
# apps/api/.env
DATABASE_URL=mysql://user:pass@host:3306/proxima
NGINX_SITES_PATH=/etc/nginx/conf.d
CERTBOT_WEBROOT=/var/www/certbot
VPS_HOST=tu-vps-ip
NODE_ENV=production
API_PORT=3001
JWT_SECRET=cambiar_esto

# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXTAUTH_SECRET=cambiar_esto
NEXTAUTH_URL=http://localhost:3000
ADMIN_EMAIL=admin@tudominio.com
ADMIN_PASSWORD_HASH=bcrypt_hash_aqui
```

---

## 13. Primer sprint con Claude Code

Orden de archivos a generar en la primera sesión:

1. `proxima/package.json` (monorepo workspace)
2. `apps/api/src/db/connection.ts`
3. `apps/api/src/db/schema.sql`
4. `apps/api/src/services/nginx.service.ts`
5. `apps/api/src/services/certbot.service.ts`
6. `apps/api/src/services/health.service.ts`
7. `apps/api/src/services/dns.service.ts`
8. `apps/api/src/routes/accounts.ts`
9. `apps/api/src/server.ts`
10. `apps/web/app/(dashboard)/page.tsx`

---

*Proxima — v1.0 — Plan generado con Claude | Stack: Next.js 14 + Fastify + MySQL + NGINX*
