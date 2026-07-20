# Clean Car

PWA de gestión para un lavadero de autos: boxes, catálogo de servicios,
registro de lavados y consulta de ventas. Migración de una aplicación
Oracle APEX a un frontend React (TanStack Start) contra el mismo backend
Oracle/ORDS.

## Stack

- **[TanStack Start](https://tanstack.com/start)** (SSR vía Nitro) + **[TanStack Router](https://tanstack.com/router)** — routing por archivos en `src/routes/`
- **React 19** + **TypeScript**
- **Tailwind CSS v4** + componentes **shadcn/ui** (Radix)
- **Vite 8**
- **[Bun](https://bun.sh)** como package manager (`bun.lock`)
- **Backend**: paquetes PL/SQL expuestos como API REST vía Oracle ORDS

> Al ser una app con servidor (SSR/Nitro), **no se puede desplegar en GitHub
> Pages** (solo sirve estático). Usar Vercel, Netlify, o cualquier host que
> corra el server de Nitro generado por `bun run build`.

## Requisitos

- Node.js 20+ (o Bun 1.1+)
- Acceso a una instancia Oracle con ORDS habilitado

## Scripts

```bash
bun install        # instalar dependencias (o: npm install)
cp .env.example .env  # completar VITE_API_URL

bun run dev        # servidor de desarrollo → http://localhost:8080
bun run build      # build de producción (.output/)
bun run preview    # previsualizar el build
bun run lint       # ESLint
bun run format     # Prettier
```

> Los scripts usan `vite`; podés reemplazar `bun run` por `npm run` si no tenés Bun.

## Backend (Oracle / ORDS)

Los scripts SQL viven en [backend/](backend/) y se ejecutan **en orden** contra
el schema de la app (`WKSP_EVAMAR`):

```sql
@backend/login.sql               -- autenticación: CC_JWT, CC_AUTH, /auth/*
@backend/boxes.sql                -- BOX_LAV
@backend/servicios.sql            -- SERVICIOS_LAV (lectura) + SERVICIOS_LAVADERO
@backend/catalogo-servicios.sql   -- SERVICIOS_LAV (CRUD completo)
```

Cada script es idempotente (`CREATE OR REPLACE` + borra el handler ORDS antes
de redefinirlo), así que se puede reejecutar sin duplicar nada.

La URL base del backend se configura con `VITE_API_URL`:

```bash
# .env
VITE_API_URL=https://oracleapex.com/ords/wksp_evamar/api
```

Login con **token opaco** (tabla `CC_TOKENS`, expiración 12hs) contra los
usuarios de APEX. El cliente vive en `src/lib/auth.tsx`. Solo dos usuarios
(`JOSEG`, `EVAC`) pueden editar/eliminar registros — el resto solo puede
consultar y dar de alta (`CC_AUTH.ES_ADMIN` en `backend/login.sql`).

Detalle de la arquitectura de auth, cómo agregar un endpoint nuevo y
troubleshooting: **[backend/GUIA.md](backend/GUIA.md)**.

## Cómo se armó cada pantalla

**[GUIA-CRUD.md](GUIA-CRUD.md)** es la receta seguida para migrar cada
página de APEX a esta PWA (backend → cliente → UI), las convenciones de
código y diseño del proyecto, y la tabla de qué página de APEX corresponde
a qué archivo del repo. Es el punto de partida para agregar o modificar
cualquier pantalla nueva.

## Estructura

```
backend/                # paquetes PL/SQL + endpoints ORDS, uno por dominio
public/                 # logo, iconos PWA (favicon, apple-touch, icon-192/512), manifest
src/
  routes/               # páginas (file-based): index=login, home, boxes, servicios, ventas
  components/
    ui/                 # componentes shadcn/ui (incluye input-monto.tsx)
    registrar-lavado.tsx  # alta de lavado + ticket de impresión
    tabla-toolbar.tsx   # buscador global + encabezados ordenables de las listas
    aqua-background.tsx # fondo animado (aurora + burbujas)
  lib/                  # cliente HTTP, auth, tipos y funciones por dominio
  styles.css            # design system (tokens oklch) + estilos de impresión
```

## PWA

Instalable en el celular. Los iconos y el manifest viven en `public/`
(`manifest.webmanifest`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`,
`icon-512.png`) y se generan a partir de `public/logo.png`.
