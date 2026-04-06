# proxy-netmail — AI Agent Guide

> Mail Proxy & Network Management Platform  
> **Tagline:** *Your domain. Your mail. Your rules.*

---

## Project Overview

**proxy-netmail** (also referred to as "Proxima" in internal documentation) is a web-based platform for managing email proxy servers. It allows an administrator to configure, monitor, and troubleshoot multiple email accounts using Hostinger servers as the backend, while exposing custom domains (IMAP/SMTP/POP3) to end users.

### Key Capabilities
- Generate NGINX stream proxy configuration
- Issue and renew SSL certificates via Certbot/Let's Encrypt
- Verify DNS propagation
- Periodic health checks for each protocol (IMAP/SMTP/POP3)
- Automatic diagnostics and incident alerts
- One-click SSL renewal

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 14 (App Router) | SSR + Client Components + SSE support |
| Backend API | Fastify | Lightweight, fast, shell commands + streams |
| Database | MySQL (remote) | Account and configuration storage |
| Proxy Engine | NGINX (stream module) | Industry-standard mail proxy |
| SSL | Certbot + Let's Encrypt | Free, automated certificate management |
| Real-time Communication | Server-Sent Events (SSE) | No WebSockets, Next.js compatible |
| Scheduler | node-cron | Health checks and auto-renewals |
| Auth | next-auth + JWT | Admin panel session management |

---

## Project Structure

This is a **pnpm monorepo** with TypeScript.

```
proxy-netmail/
├── apps/
│   ├── api/                    # Fastify backend API
│   │   ├── src/
│   │   │   ├── config.ts       # Environment configuration
│   │   │   ├── server.ts       # Fastify server entry
│   │   │   ├── db/             # Database connection & queries
│   │   │   │   ├── connection.ts
│   │   │   │   ├── migrate.ts
│   │   │   │   ├── schema.sql
│   │   │   │   └── queries/
│   │   │   ├── plugins/        # Fastify plugins (auth, db)
│   │   │   ├── routes/         # API route handlers
│   │   │   │   ├── accounts.ts
│   │   │   │   ├── activity.ts
│   │   │   │   ├── health.ts
│   │   │   │   ├── setup.ts
│   │   │   │   ├── ssl.ts
│   │   │   │   └── system.ts
│   │   │   └── services/       # Business logic
│   │   │       ├── certbot.service.ts
│   │   │       ├── dns.service.ts
│   │   │       ├── health.service.ts
│   │   │       ├── nginx.service.ts
│   │   │       ├── scheduler.service.ts
│   │   │       └── setup.service.ts
│   │   ├── .env                # API environment variables
│   │   └── package.json
│   │
│   └── web/                    # Next.js 14 frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/login/        # Login page
│       │   │   ├── (dashboard)/         # Dashboard routes
│       │   │   │   ├── page.tsx         # Overview
│       │   │   │   ├── accounts/        # Account list & detail
│       │   │   │   ├── monitor/         # Global monitoring
│       │   │   │   ├── ssl/             # SSL certificates
│       │   │   │   └── settings/        # System settings
│       │   │   └── api/auth/[...nextauth]/  # NextAuth.js
│       │   ├── components/
│       │   │   ├── accounts/
│       │   │   ├── activity/
│       │   │   ├── health/
│       │   │   ├── setup/
│       │   │   └── ui/                  # shadcn/ui components
│       │   ├── lib/
│       │   │   ├── api.ts               # API client
│       │   │   └── utils.ts
│       │   ├── middleware.ts            # Auth middleware
│       │   └── app/layout.tsx
│       ├── .env.local
│       ├── next.config.mjs
│       ├── tailwind.config.ts
│       └── components.json              # shadcn config
│
├── packages/
│   └── shared/                 # Shared TypeScript types
│       ├── src/
│       │   ├── index.ts
│       │   └── types/
│       │       ├── account.ts
│       │       ├── health.ts
│       │       └── system.ts
│       └── package.json
│
├── package.json               # Root monorepo config
├── pnpm-workspace.yaml        # Workspace definitions
└── tsconfig.base.json         # Shared TS config
```

---

## Build & Development Commands

### Root Level (Monorepo)

```bash
# Install dependencies
pnpm install

# Run all dev servers (API + Web in parallel)
pnpm run dev

# Run only API dev server
pnpm run dev:api

# Run only Web dev server
pnpm run dev:web

# Build all apps
pnpm run build

# Run database migrations
pnpm run db:migrate
```

### API App (`apps/api`)

```bash
pnpm dev        # Start with hot reload (tsx watch)
pnpm build      # Compile TypeScript
pnpm start      # Run compiled JS
pnpm db:migrate # Execute DB migrations
```

### Web App (`apps/web`)

```bash
pnpm dev        # Start Next.js dev server
pnpm build      # Build for production
pnpm start      # Start production server
pnpm lint       # Run ESLint
```

---

## Environment Configuration

### API Environment (`apps/api/.env`)

```env
# Database
DATABASE_HOST=srv1782.hstgr.io
DATABASE_PORT=3306
DATABASE_NAME=u669953139_netmailDB
DATABASE_USER=u669953139_netmailUSER
DATABASE_PASSWORD="your-password"

# API Server
API_PORT=3001
NODE_ENV=development
JWT_SECRET=your-secret-key

# CORS
CORS_ORIGIN=http://localhost:3000

# System Paths
NGINX_SITES_PATH=/etc/nginx/conf.d
```

### Web Environment (`apps/web/.env.local`)

```env
# API URL
NEXT_PUBLIC_API_URL=http://localhost:3001

# NextAuth
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000

# Admin Credentials (for demo/simple auth)
ADMIN_EMAIL=admin@proxy-netmail.com
ADMIN_PASSWORD=admin123
```

---

## Code Style Guidelines

### Editor Configuration

The project uses **EditorConfig** and **Prettier**:

- **Indent:** 2 spaces (4 for SQL files)
- **Line endings:** LF
- **Charset:** UTF-8
- **Quote style:** Single quotes
- **Semicolons:** Required
- **Trailing commas:** All
- **Print width:** 100 characters

### TypeScript Configuration

Base config (`tsconfig.base.json`):
- Target: ES2022
- Module: ESNext
- Module resolution: Bundler
- Strict mode enabled
- Declaration maps enabled
- Source maps enabled

### Naming Conventions

- **Files:** kebab-case (e.g., `nginx.service.ts`, `account-form.tsx`)
- **Components:** PascalCase (e.g., `AccountForm`, `HealthStatusBadge`)
- **Functions/Variables:** camelCase
- **Types/Interfaces:** PascalCase
- **Constants:** UPPER_SNAKE_CASE

---

## Database Schema

### Tables

1. **`accounts`** — Email proxy accounts
2. **`ssl_certificates`** — SSL certificate tracking
3. **`health_checks`** — Protocol health check results
4. **`activity_log`** — System activity and events
5. **`diagnostics`** — Diagnostic reports
6. **`system_config`** — Global configuration key-value store

See `apps/api/src/db/schema.sql` for full definitions.

### Database Queries

Located in `apps/api/src/db/queries/`:
- `accounts.ts` — Account CRUD operations
- `ssl.ts` — SSL certificate queries
- `health_checks.ts` — Health check queries
- `activity_log.ts` — Activity logging
- `system.ts` — System config queries

---

## API Architecture

### Route Structure

| Endpoint | Description |
|----------|-------------|
| `GET /api/accounts` | List all accounts |
| `POST /api/accounts` | Create new account |
| `GET /api/accounts/:id` | Get account details |
| `PUT /api/accounts/:id` | Update account |
| `DELETE /api/accounts/:id` | Delete account |
| `POST /api/accounts/:id/setup` | Full setup pipeline (SSE) |
| `POST /api/accounts/:id/ssl/issue` | Issue SSL certificate |
| `POST /api/accounts/:id/ssl/renew` | Renew SSL certificate |
| `GET /api/health/all` | Global health status |
| `GET /api/system/status` | System status |

### Authentication

- **API:** JWT-based (`@fastify/jwt`)
- **Web:** NextAuth.js with Credentials provider
- Default admin credentials configured via environment variables

### Services

Business logic is organized in `apps/api/src/services/`:

- **`nginx.service.ts`** — NGINX config generation, validation, reload
- **`certbot.service.ts`** — SSL certificate issuance and renewal
- **`health.service.ts`** — TCP + SSL health checks
- **`dns.service.ts`** — DNS propagation verification
- **`scheduler.service.ts`** — Cron job scheduling for health checks
- **`setup.service.ts`** — Full account setup pipeline

---

## Frontend Architecture

### Routing (App Router)

```
/                    → Dashboard Overview
/accounts            → Account list
/accounts/[id]       → Account detail
/monitor             → Global monitoring
/ssl                 → SSL certificates
/settings            → System settings
/login               → Login page
```

### Components

Organized by feature:
- `accounts/` — Account management
- `activity/` — Activity feed
- `health/` — Health status indicators
- `setup/` — Setup progress UI
- `ui/` — Reusable shadcn/ui components

### Styling

- **Framework:** Tailwind CSS
- **Components:** shadcn/ui (base-nova style)
- **Icons:** Lucide React
- **Animation:** tailwindcss-animate

---

## Testing Strategy

Currently, the project does not have automated tests configured. Testing is primarily manual through:

1. **API Testing:** Direct HTTP requests to endpoints
2. **Health Checks:** Built-in health monitoring service
3. **Setup Pipeline:** SSE stream for real-time setup progress

**Note:** Consider adding:
- Unit tests with Vitest/Jest
- API integration tests
- E2E tests with Playwright

---

## Deployment Considerations

### Production Requirements

1. **VPS/Server with:**
   - Node.js >= 20.0.0
   - NGINX with stream module
   - Certbot installed
   - MySQL database access

2. **System Paths:**
   - NGINX config directory: `/etc/nginx/conf.d`
   - Certbot webroot: `/var/www/certbot`

3. **Firewall:**
   - Ports 993 (IMAP), 465 (SMTP), 995 (POP3) must be open

### Security Considerations

- Change default `JWT_SECRET` and `NEXTAUTH_SECRET` in production
- Use strong admin credentials
- Restrict database access
- Enable HTTPS for web dashboard
- Review NGINX configuration before applying
- SSL certificates are automatically renewed (configurable threshold)

---

## Development Notes

### Adding a New API Route

1. Create route handler in `apps/api/src/routes/`
2. Register in `apps/api/src/server.ts`
3. Add corresponding types in `packages/shared/src/types/` if needed

### Adding a Database Query

1. Add SQL query function in `apps/api/src/db/queries/`
2. Update schema in `apps/api/src/db/schema.sql` if needed
3. Run `pnpm db:migrate` to apply changes

### Adding a Shared Type

1. Define in `packages/shared/src/types/`
2. Export from `packages/shared/src/index.ts`
3. Import from `@proxy-netmail/shared` in apps

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Database connection fails | Check `.env` credentials and network access |
| NGINX commands fail on Windows | Normal — skipped automatically on Windows |
| CORS errors | Verify `CORS_ORIGIN` matches web URL |
| Port already in use | Change `API_PORT` or kill existing process |

---

## References

- **Development Plan:** `proxima-dev-plan.md` (Spanish)
- **Package Manager:** pnpm
- **Runtime:** Node.js >= 20.0.0
