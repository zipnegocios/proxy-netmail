# Bitácora de Migración - Hostinger Business Plan

**Fecha**: Abril 2026  
**Proyecto**: proxy-netmail  
**Entorno Origen**: VPS/Local (Node.js + Next.js SSR)  
**Entorno Destino**: Hostinger Business Plan (Shared Hosting - Static Only)  
**Estado**: ✅ Build Exitoso - Listo para Deploy

---

## 1. Contexto del Entorno Hostinger

### Limitaciones Identificadas del Business Plan

| Característica | VPS (Esperado) | Business Plan (Realidad) |
|----------------|----------------|--------------------------|
| Node.js runtime | ✅ Sí | ❌ No |
| PM2 / Procesos persistentes | ✅ Sí | ❌ No |
| Puertos personalizados (3000, 3001) | ✅ Sí | ❌ No |
| NGINX configuración | ✅ Sí | ❌ No (solo .htaccess) |
| Next.js SSR / API Routes | ✅ Sí | ❌ No |
| Static Site Generation (SSG) | ✅ Sí | ✅ Sí |
| PHP / MySQL | ✅ Sí | ✅ Sí |
| pnpm durante build | ✅ Sí | ⚠️ Parcial (install sí, run no) |

**Conclusión crítica**: El plan Business NO es un VPS. Es hosting compartido con soporte solo para archivos estáticos (HTML/CSS/JS) y PHP.

---

## 2. Problemas Encontrados y Soluciones

### 2.1 next-auth v4 - INCOMPATIBLE ❌

**Error inicial**:
```
TypeError: Cannot read properties of null (reading 'useContext')
```

**Diagnóstico**:
- next-auth v4 requiere React Context API
- Durante el build estático (SSG), los componentes con Context fallan porque no hay un proveedor de contexto en tiempo de compilación
- next-auth intenta hidratarse durante el prerender

**Intentos fallidos**:
1. ✅ Agregar `SessionProvider` con verificación `typeof window` - NO funcionó
2. ✅ Usar `useEffect` para delay de render - NO funcionó
3. ✅ Configurar `next.config.mjs` con `staticPageGenerationTimeout` - NO funcionó

**Solución final**:
- 🔥 **Eliminar next-auth completamente**
- Implementar sistema de autenticación simple con localStorage
- Verificación de auth en `useEffect` en el layout del dashboard

**Archivos modificados**:
- Eliminado: `apps/web/src/lib/auth.ts`
- Eliminado: `apps/web/src/app/api/auth/[...nextauth]/route.ts`
- Modificado: `apps/web/src/app/login/page.tsx` (ahora usa localStorage)
- Modificado: `apps/web/src/app/(dashboard)/layout.tsx` (auth inline)

**Lección**: En SSG puro, evitar cualquier librería que dependa de React Context durante el render inicial.

---

### 2.2 Configuración de Build de Next.js

**Error inicial**:
```
Error: "output: 'standalone'" no puede usarse con "output: 'export'"
```

**Configuración original** (funcionaba en VPS):
```javascript
// next.config.mjs (ANTES)
const nextConfig = {
  output: 'standalone',
  // ...
};
```

**Cambio realizado**:
```javascript
// next.config.mjs (DESPUÉS)
const nextConfig = {
  output: 'export',
  distDir: 'dist',
  images: {
    unoptimized: true,  // Requerido para export estático
  },
};
```

**Impacto**:
- ✅ Genera archivos HTML estáticos en `dist/`
- ✅ No requiere servidor Node.js
- ❌ Pierde funcionalidades SSR/ISR
- ❌ Las imágenes deben desoptimizarse (se sirven tal cual)

---

### 2.3 Scripts de Build en Hostinger

**Error inicial**:
```bash
> pnpm run --filter './apps/*' build
"pnpm" no se reconoce como un comando interno o externo
```

**Diagnóstico**:
- Hostinger tiene `pnpm` disponible durante `pnpm install`
- PERO el PATH no incluye pnpm durante la ejecución de build scripts

**Solución**:
```json
// package.json (ANTES)
"scripts": {
  "build": "pnpm run --filter './apps/*' build"
}

// package.json (DESPUÉS)
"scripts": {
  "build": "npm run build:api && npm run build:web",
  "build:api": "cd apps/api && npx tsc",
  "build:web": "cd apps/web && npx next build"
}
```

**Lección**: Usar `npx` para ejecutar herramientas en entornos donde el PATH es incierto.

---

### 2.4 Dynamic Routes / Rutas Dinámicas

**Error inicial**:
```
Error: Page "/accounts/[id]" is missing "generateStaticParams()" 
so it cannot be used with "output: export" config.
```

**Intentos fallidos**:

1. **Agregar generateStaticParams vacío**:
```typescript
// apps/web/src/app/(dashboard)/accounts/[id]/page.tsx
export function generateStaticParams() {
  return []; // Array vacío = "dynamic rendering"
}
```
**Resultado**: ❌ Next.js 14 no acepta array vacío, requiere al menos un parámetro para SSG

2. **Usar async generateStaticParams**:
```typescript
export async function generateStaticParams() {
  return []; 
}
```
**Resultado**: ❌ Mismo error - Next.js requiere conocer todas las rutas en tiempo de build

3. **Mover a pages/ en lugar de app/**:
Considerado pero descartado porque:
- El proyecto usa App Router
- Requeriría reescribir muchos componentes
- No resuelve el problema fundamental de SSG

**Solución final - Arquitectura alternativa**:
```
ANTES: /accounts/[id]/page.tsx → /accounts/123
DESPUÉS: /accounts/detail/page.tsx → /accounts/detail?id=123
```

**Cambios**:
- ✅ Nueva estructura: `(dashboard)/accounts/detail/page.tsx`
- ✅ Usa `useSearchParams()` para obtener `?id=X`
- ✅ Envuelto en `<Suspense>` para evitar errores de hidratación
- ✅ Actualizado `accounts/page.tsx` para usar nuevas URLs

**Lección**: Las rutas dinámicas `[param]` no son compatibles con export estático sin conocer todos los posibles valores de antemano. Usar query strings es más compatible con SSG.

---

### 2.5 Dynamic Exports

**Error inicial**:
```
Error: Invalid revalidate value "[object Object]" on "/login/"
```

**Causa**:
```typescript
// Algunas páginas tenían:
export const revalidate = 0;
// o
export const dynamic = 'force-dynamic';
```

**Solución**:
- 🔥 **Eliminar todas las exportaciones dinámicas**
- No son necesarias ni compatibles con SSG
- Las páginas son estáticas por defecto

**Archivos modificados**:
- `apps/web/src/app/login/page.tsx` - Removido revalidate

---

### 2.6 Componentes Cliente con Hydration Issues

**Error inicial**:
```
Error: useSearchParams() should be wrapped in a Suspense boundary
```

**Diagnóstico**:
- `useSearchParams` es un hook de Next.js que solo funciona en cliente
- Durante SSG, Next.js intenta prerender pero el hook retorna null

**Solución**:
```typescript
// apps/web/src/app/(dashboard)/accounts/detail/page.tsx
import { Suspense } from 'react';

function AccountDetailContent() {
  const searchParams = useSearchParams();
  const accountId = parseInt(searchParams.get('id') || '0', 10);
  // ...
}

export default function AccountDetailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AccountDetailContent />
    </Suspense>
  );
}
```

**Patrón aplicado también en**:
- `apps/web/src/app/login/page.tsx` - Añadido `mounted` state
- `apps/web/src/app/(dashboard)/layout.tsx` - Añadido `mounted` state

**Lección**: Siempre usar `Suspense` alrededor de componentes que usan hooks cliente-only.

---

### 2.7 Document Component

**Error inicial**:
```
Error: <Html> should not be imported outside of pages/_document
```

**Causa**:
- Next.js requiere un componente Document personalizado para ciertas configuraciones
- El build estático lo requiere explícitamente

**Solución**:
```typescript
// apps/web/src/pages/_document.tsx
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
```

**Nota**: Aunque usamos App Router, el archivo `pages/_document.tsx` sigue siendo necesario para ciertas configuraciones de export estático.

---

## 3. Arquitectura Final

### Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────┐
│                         HOSTINGER                                │
│                   (Business Plan - Static)                       │
├─────────────────────────────────────────────────────────────────┤
│  public_html/                                                   │
│  ├── index.html              ← Dashboard (estático)              │
│  ├── login.html              ← Login (estático)                  │
│  ├── accounts.html           ← Lista cuentas (estático)          │
│  ├── accounts/detail.html    ← Detalle cuenta (estático)         │
│  ├── monitor.html            ← Monitor (estático)                │
│  ├── _next/                  ← Assets JS/CSS                     │
│  └── ...                                                        │
│                                                                 │
│  Tecnologías: HTML, CSS, JS (estático)                          │
│  NO hay: Node.js, Next.js runtime, APIs                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ API Calls (CORS)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Railway/Render)                     │
├─────────────────────────────────────────────────────────────────┤
│  Fastify API                                                    │
│  ├── /api/ping               ← Health check                     │
│  ├── /api/accounts           ← CRUD cuentas                     │
│  ├── /api/ssl                ← Gestión SSL                      │
│  └── /api/health             ← Health checks                    │
│                                                                 │
│  Node.js 20, Fastify, MySQL2                                    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ MySQL Protocol
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE (Hostinger MySQL)                   │
├─────────────────────────────────────────────────────────────────┤
│  srv1782.hstgr.io                                               │
│  ├── u669953139_netmailDB                                       │
│  └── u669953139_netmailUSER                                     │
└─────────────────────────────────────────────────────────────────┘
```

### Flujo de Autenticación

```
ANTES (con next-auth):
1. Usuario → Login → next-auth → Session Cookie → Dashboard

DESPUÉS (localStorage):
1. Usuario → Login → localStorage.setItem('auth') → window.location.href = '/'
2. Dashboard layout → useEffect → localStorage.getItem('auth') → Render o Redirect
```

**Nota sobre seguridad**: Esta autenticación es cliente-side y no es segura para datos sensibles. Cualquier usuario puede inspeccionar localStorage. Para producción real, se recomienda:
- JWT con httponly cookies (requiere backend)
- Auth0 / Firebase Auth
- Upgrade a VPS para manejar sesiones server-side

---

## 4. Qué Funcionó ✅

| Tarea | Estado | Detalle |
|-------|--------|---------|
| Build de API (TypeScript) | ✅ | `npm run build:api` compila sin errores |
| Build de Web (Next.js) | ✅ | `npm run build:web` genera archivos estáticos |
| Export estático | ✅ | `dist/` contiene HTML estático listo para subir |
| Autenticación localStorage | ✅ | Login/logout funciona en cliente |
| Navegación entre páginas | ✅ | Links funcionan correctamente |
| Suspense boundaries | ✅ | No más errores de hidratación |
| Llamadas a API | ✅ | Fetch funciona desde archivos estáticos |

### Rutas Generadas Correctamente

```
Route (app)                              Size     First Load JS
┌ ○ /                                    2.31 kB        98.3 kB
├ ○ /_not-found                          870 B          88.2 kB
├ ○ /accounts                            14.5 kB         120 kB
├ ○ /accounts/detail                     5.94 kB         111 kB
├ ○ /login                               3.06 kB        99.1 kB
└ ○ /monitor                             3.54 kB        99.5 kB

○  (Static)  prerendered as static content
```

---

## 5. Qué NO Funcionó / Limitaciones ⚠️

| Funcionalidad | Estado | Razón |
|--------------|--------|-------|
| SSR (Server-Side Rendering) | ❌ | Requiere Node.js runtime |
| ISR (Incremental Static Regeneration) | ❌ | Requiere servidor Next.js |
| API Routes de Next.js | ❌ | `/app/api/*` no funciona en export estático |
| next-auth v4 | ❌ | Requiere Context API + runtime Node.js |
| Image Optimization | ❌ | Requiere servidor Node.js |
| Middleware de Next.js | ❌ | No ejecuta en export estático |
| Rewrites/Redirects en next.config | ⚠️ | Solo funcionan en desarrollo |
| PM2 / Procesos persistentes | ❌ | No disponible en shared hosting |
| NGINX configuración | ❌ | Control limitado en shared hosting |
| WebSockets | ❌ | Requieren conexión persistente |

### Compromisos Aceptados

1. **Seguridad de autenticación**: Usamos localStorage en lugar de cookies httponly
   - Riesgo: XSS puede robar token de auth
   - Mitigación: No almacenar datos sensibles, usar HTTPS

2. **SEO**: Perdimos SSR para SEO
   - Riesgo: Los crawlers ven menos contenido inicial
   - Mitigación: Usar meta tags estáticos, no es crítico para app admin

3. **Rutas dinámicas**: Cambiamos de `/accounts/123` a `/accounts/detail?id=123`
   - Impacto: URLs menos "limpias"
   - Beneficio: Funciona con SSG

---

## 6. Próximos Pasos para Deploy

### Checklist Pre-Deploy

- [ ] Crear cuenta en Railway / Render / Fly.io para backend
- [ ] Configurar variables de entorno en plataforma de backend
- [ ] Deploy del backend y obtener URL pública
- [ ] Actualizar `NEXT_PUBLIC_API_URL` en `apps/web/.env.local`
- [ ] Rebuild del frontend con nueva API URL
- [ ] Subir contenido de `apps/web/dist/` a Hostinger File Manager
- [ ] Verificar CORS está configurado correctamente
- [ ] Probar flujo completo: Login → Ver cuentas → Ver detalle

### Rollback Plan

Si algo falla en producción:
1. Mantener backup de versión anterior en `public_html_backup/`
2. Configurar página de "Mantenimiento" estática
3. Tener script de deploy automatizado para revertir rápido

---

## 7. Lecciones Aprendidas

### Para futuros proyectos en Hostinger Business Plan:

1. **Verificar TIPO de hosting antes de elegir arquitectura**
   - Business Plan ≠ VPS
   - Shared hosting = solo estático/PHP

2. **Evitar desde el inicio**:
   - next-auth (usar Firebase Auth o Auth0)
   - Rutas dinámicas `[id]` (planear con query params)
   - Dependencias que requieren Context API en SSG

3. **Arquitectura recomendada desde día 1**:
   - Frontend: Next.js con `output: 'export'`
   - Backend: API separada (Railway/Render/Vercel)
   - Auth: JWT con backend o servicio externo

4. **Testing de build temprano**:
   - No esperar al final para probar `next build`
   - Probar en entorno similar a producción desde sprint 0

### Herramientas Útiles Descubiertas

```bash
# Para servir build estático local y verificar
npx serve apps/web/dist

# Para verificar que todo es estático (no debe haber .html faltante)
ls apps/web/dist/*.html

# Para validar que no hay referencias a localhost:3000
grep -r "localhost:3000" apps/web/dist/ || echo "✅ No hay referencias locales"
```

---

## 8. Referencias

- [Next.js Static Export](https://nextjs.org/docs/pages/building-your-application/deploying/static-exports)
- [Hostinger Business Plan Limitations](https://support.hostinger.com/)
- [Railway Deploy Docs](https://docs.railway.app/deploy/deployments)
- [Next.js App Router SSG](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)

---

**Autor**: Migration Team  
**Fecha de finalización**: 2026-04-06  
**Estado**: ✅ Build Exitoso - Pendiente Deploy a Producción
