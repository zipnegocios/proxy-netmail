# Guía de Despliegue - Hostinger VPS

## Variables de Entorno Requeridas

### `apps/api/.env`
```env
DATABASE_HOST=srv1782.hstgr.io
DATABASE_PORT=3306
DATABASE_NAME=u669953139_netmailDB
DATABASE_USER=u669953139_netmailUSER
DATABASE_PASSWORD="u669953139_netmail#$PWD"
API_PORT=3001
NODE_ENV=production
JWT_SECRET=proxy-netmail-dev-secret-change-in-production
NGINX_SITES_PATH=/etc/nginx/conf.d
CORS_ORIGIN=https://olivedrab-gnu-416802.hostingersite.com
```

### `apps/web/.env.local`
```env
NEXT_PUBLIC_API_URL=https://olivedrab-gnu-416802.hostingersite.com/api
NEXTAUTH_URL=https://olivedrab-gnu-416802.hostingersite.com
NEXTAUTH_SECRET=proxy-netmail-dev-secret-change-in-production
ADMIN_EMAIL=admin@proxy-netmail.com
ADMIN_PASSWORD=Judini#$2026
```

## Configuración NGINX

Crear archivo `/etc/nginx/conf.d/proxy-netmail.conf`:

```nginx
server {
    listen 80;
    server_name olivedrab-gnu-416802.hostingersite.com;
    
    # Redirigir HTTP a HTTPS (si tienes SSL configurado)
    # return 301 https://$server_name$request_uri;
    
    # Frontend Next.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # API Fastify
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Configuración SSL (Hostinger generalmente lo configura automáticamente)
# Si necesitas configurarlo manualmente con Let's Encrypt:
# server {
#     listen 443 ssl http2;
#     server_name olivedrab-gnu-416802.hostingersite.com;
#     
#     ssl_certificate /etc/letsencrypt/live/tu-dominio/fullchain.pem;
#     ssl_certificate_key /etc/letsencrypt/live/tu-dominio/privkey.pem;
#     
#     # ... mismas location blocks de arriba
# }
```

Verificar y recargar NGINX:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Opción 1: Iniciar con PM2 (Recomendado)

```bash
# Instalar PM2 globalmente si no está instalado
npm install -g pm2

# En el directorio del proyecto
cd /home/u669953139/domains/olivedrab-gnu-416802.hostingersite.com/public_html

# Iniciar servicios
npm run start:pm2

# Ver estado
pm2 status

# Ver logs
pm2 logs
# o
npm run logs:pm2

# Reiniciar
npm run restart:pm2

# Detener
npm run stop:pm2

# Configurar inicio automático
pm2 startup systemd
pm2 save
```

## Opción 2: Iniciar con Script Bash

```bash
# En el directorio del proyecto
cd /home/u669953139/domains/olivedrab-gnu-416802.hostingersite.com/public_html

# Dar permisos al script (primera vez)
chmod +x start.sh

# Ejecutar
./start.sh

# El script mantendrá ambos servicios corriendo
# Presiona Ctrl+C para detener ambos
```

## Proceso de Build y Deploy Completo

```bash
# 1. Conectar al VPS via SSH
ssh u669953139@srv1782.hstgr.io

# 2. Ir al directorio del proyecto
cd /home/u669953139/domains/olivedrab-gnu-416802.hostingersite.com/public_html

# 3. Obtener últimos cambios (si usas git)
git pull origin main

# 4. Instalar dependencias
pnpm install

# 5. Ejecutar builds
npm run build

# 6. Ejecutar migraciones de base de datos (si hay cambios)
npm run db:migrate

# 7. Reiniciar servicios (con PM2)
npm run restart:pm2

# 8. Verificar logs
pm2 logs
```

## Verificación Post-Deploy

Verificar que los servicios están corriendo:
```bash
# Ver procesos en puertos 3000 y 3001
netstat -tlnp | grep -E '3000|3001'

# O con ss
ss -tlnp | grep -E '3000|3001'

# Probar API localmente
curl http://localhost:3001/api/ping

# Probar desde fuera
curl https://olivedrab-gnu-416802.hostingersite.com/api/ping
```

## Troubleshooting

### Error: EACCES permission denied
```bash
# Cambiar permisos al directorio
sudo chown -R $USER:$USER /home/u669953139/domains/olivedrab-gnu-416802.hostingersite.com/public_html
```

### Error: Port already in use
```bash
# Encontrar proceso usando el puerto
sudo lsof -i :3001
# o
sudo netstat -tlnp | grep 3001

# Matar proceso
sudo kill -9 <PID>
```

### Logs de PM2 no muestran nada
```bash
# Limpiar logs antiguos
pm2 flush

# Ver logs en tiempo real
pm2 logs --lines 100
```

### Error de CORS
Verificar que `CORS_ORIGIN` en `apps/api/.env` coincide exactamente con la URL de acceso (incluyendo https://).

## Estructura de Archivos en Producción

```
/home/u669953139/domains/olivedrab-gnu-416802.hostingersite.com/public_html/
├── apps/
│   ├── api/
│   │   ├── dist/          ← Build del API
│   │   ├── .env           ← Variables de entorno API
│   │   └── ...
│   └── web/
│       ├── .next/         ← Build de Next.js
│       ├── .env.local     ← Variables de entorno Web
│       └── ...
├── logs/                  ← Logs de PM2
│   ├── api-error.log
│   ├── api-out.log
│   ├── web-error.log
│   └── web-out.log
├── ecosystem.config.js    ← Configuración PM2
├── start.sh              ← Script de inicio alternativo
└── ...
```

## Comandos Útiles de PM2

```bash
pm2 status              # Ver estado de procesos
pm2 logs                # Ver logs en tiempo real
pm2 logs --lines 500    # Ver últimas 500 líneas
pm2 monit               # Monitor interactivo
pm2 reload all          # Recargar todos los procesos
pm2 delete all          # Detener y eliminar todos
pm2 save                # Guardar configuración
pm2 resurrect           # Restaurar procesos guardados
```
