# Guía de Despliegue - Hostinger Business Plan

> **IMPORTANTE**: El plan Business de Hostinger es hosting compartido (shared hosting), NO VPS. Esto significa:
> - No puedes correr procesos Node.js permanentemente (PM2 no funciona)
> - No tienes acceso a NGINX
> - No puedes usar puertos personalizados
> 
> **Solución**: El frontend se sirve como archivos estáticos desde el hosting. El backend (API) debe desplegarse en un servicio separado como Railway, Render, o Vercel.

## Resumen de la Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Next.js estático)                                │
│  → Hostinger Business Plan                                  │
│  → https://olivedrab-gnu-416802.hostingersite.com         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ API calls
┌─────────────────────────────────────────────────────────────┐
│  Backend (Fastify API)                                      │
│  → Railway / Render / Vercel / Otro hosting Node.js        │
│  → https://proxy-netmail-api.railway.app (ejemplo)         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ MySQL queries
┌─────────────────────────────────────────────────────────────┐
│  Database                                                   │
│  → Hostinger MySQL (srv1782.hstgr.io)                       │
└─────────────────────────────────────────────────────────────┘
```

## Paso 1: Configurar Variables de Entorno

### `apps/web/.env.local`
```env
# URL del backend (cambiar después de desplegar la API)
NEXT_PUBLIC_API_URL=https://tu-api-en-railway.app/api

# Credenciales de admin (autenticación cliente)
NEXT_PUBLIC_ADMIN_EMAIL=admin@proxy-netmail.com
NEXT_PUBLIC_ADMIN_PASSWORD=Judini#$2026
```

### `apps/api/.env` (para desplegar backend en Railway/Render)
```env
DATABASE_HOST=srv1782.hstgr.io
DATABASE_PORT=3306
DATABASE_NAME=u669953139_netmailDB
DATABASE_USER=u669953139_netmailUSER
DATABASE_PASSWORD="u669953139_netmail#$PWD"
API_PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://olivedrab-gnu-416802.hostingersite.com
```

## Paso 2: Build del Frontend

```bash
# En tu máquina local (o CI/CD)
cd apps/web

# Crear archivo .env.local con las variables de arriba
echo "NEXT_PUBLIC_API_URL=https://tu-api-en-railway.app/api" > .env.local
echo "NEXT_PUBLIC_ADMIN_EMAIL=admin@proxy-netmail.com" >> .env.local
echo "NEXT_PUBLIC_ADMIN_PASSWORD=Judini#$2026" >> .env.local

# Build estático
npm run build

# El resultado estará en apps/web/dist/
```

## Paso 3: Subir a Hostinger (File Manager o FTP)

### Opción A: File Manager (más fácil)

1. Accede al panel de Hostinger
2. Ve a File Manager
3. Navega a `domains/olivedrab-gnu-416802.hostingersite.com/public_html`
4. Elimina todo el contenido existente (o muévelo a backup)
5. Sube el contenido de `apps/web/dist/`:
   - index.html
   - login.html
   - accounts.html
   - monitor.html
   - 404.html
   - Carpeta `_next/`
   - Carpeta `accounts/`

### Opción B: FTP

```bash
# Usando lftp o FileZilla
# Host: srv1782.hstgr.io
# Usuario: u669953139
# Password: (tu password de FTP)
# Puerto: 21

# Directorio remoto: /domains/olivedrab-gnu-416802.hostingersite.com/public_html
# Directorio local: apps/web/dist/
```

## Paso 4: Desplegar el Backend (Railway)

Railway ofreere despliegue gratuito con soporte para Node.js:

1. Crea cuenta en https://railway.app
2. Crea nuevo proyecto → Deploy from GitHub repo
3. Selecciona tu repo `proxy-netmail`
4. Configura el root directory como `apps/api`
5. Añade variables de entorno en Railway Dashboard:
   - `DATABASE_HOST=srv1782.hstgr.io`
   - `DATABASE_PORT=3306`
   - etc.
6. Railway detectará automáticamente el `package.json` y el `start` script

### Configuración para Railway (package.json)

Asegúrate de que `apps/api/package.json` tenga:
```json
{
  "scripts": {
    "start": "node dist/index.js",
    "build": "tsc"
  }
}
```

Y crea un `Procfile` en `apps/api/`:
```
web: node dist/index.js
```

O usa `railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node dist/index.js",
    "healthcheckPath": "/api/ping"
  }
}
```

## Paso 5: Configurar CORS

Después de obtener la URL del backend (ej: `https://proxy-netmail-api.up.railway.app`), actualiza:

1. **En Railway**: Agrega la variable `CORS_ORIGIN=https://olivedrab-gnu-416802.hostingersite.com`

2. **En tu local**: Actualiza `apps/web/.env.local` con la nueva API URL y haz rebuild

3. **Re-subir** los archivos estáticos a Hostinger

## Estructura de Archivos en Hostinger

```
/domains/olivedrab-gnu-416802.hostingersite.com/public_html/
├── index.html                 ← Dashboard
├── login.html                 ← Login
├── accounts.html              ← Accounts list
├── accounts/
│   └── detail.html            ← Account detail
├── monitor.html               ← Monitor page
├── 404.html                   ← 404 page
├── favicon.ico
└── _next/                     ← Assets de Next.js
    ├── static/
    └── ...
```

## Troubleshooting

### Error: "Cannot read properties of null (reading 'useContext')"
Este error ocurre cuando next-auth intenta hidratarse durante el build estático. 
**Solución**: Ya está implementada - usamos localStorage-based auth en lugar de next-auth.

### Error: "Invalid revalidate value"
**Solución**: Ya está implementada - eliminamos `export const revalidate` de todas las páginas.

### Error: "generateStaticParams() required"
Las páginas dinámicas como `/accounts/[id]` requieren `generateStaticParams()` para export estático.
**Solución**: Cambiamos a `/accounts/detail?id=X` (query params en lugar de route params).

### Error: "useSearchParams() should be wrapped in Suspense"
**Solución**: La página de detalle ya usa Suspense alrededor del componente que usa useSearchParams.

### Página 404 en rutas del dashboard
En hosting estático, el enrutamiento del lado del cliente puede fallar al refrescar.
**Solución**: Asegúrate de que todas las rutas existan como archivos HTML:
- `/` → `index.html`
- `/login` → `login.html` 
- `/accounts` → `accounts.html`
- `/accounts/detail` → `accounts/detail.html`
- `/monitor` → `monitor.html`

### API no responde (CORS error)
Verifica:
1. La variable `CORS_ORIGIN` en el backend coincide exactamente con la URL del frontend (incluyendo https://)
2. No hay slash al final de la URL
3. La URL de la API en el frontend es accesible públicamente

## Comandos Útiles para Testing Local

```bash
# Servir el build estático localmente
npx serve apps/web/dist

# O con Python
python -m http.server 8080 --directory apps/web/dist

# Verificar que la API responde
curl https://tu-api-en-railway.app/api/ping
```

## Actualización del Deploy

Para actualizar el frontend:
```bash
# 1. Modificar código
# 2. Rebuild
npm run build

# 3. Subir archivos actualizados (solo los que cambiaron)
# Usando File Manager de Hostinger o FTP
```

Para actualizar el backend:
```bash
# Si usas Railway: git push y Railway redeploya automáticamente
# Si usas Render: git push y Render redeploya automáticamente
```

## Alternativas al Backend

Si Railway no es una opción, considera:

1. **Render.com**: Similar a Railway, tiene tier gratuito
2. **Vercel**: Serverless functions (requiere adaptar el código)
3. **Cyclic.sh**: Hosting gratuito para Node.js
4. **Fly.io**: Tiene tier gratuito
5. **Upgrade a Hostinger VPS**: Te permitiría correr todo en un solo servidor

## Notas sobre Autenticación

Dado que estamos en hosting estático sin servidor Node.js:
- La autenticación es cliente-side usando localStorage
- No es segura para datos sensibles (cualquiera puede ver el código)
- Para producción real, considera agregar autenticación server-side en la API
- O usa un servicio de autenticación como Auth0, Firebase Auth, etc.
