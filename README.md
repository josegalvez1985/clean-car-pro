# Clean Car

Aplicación web (PWA) para la carga rápida de lavados de autos y camionetas.
Pensada para uso en el celular: login, alta de lavado y modo claro/oscuro.

## Stack

- **[TanStack Start](https://tanstack.com/start)** (SSR) + **[TanStack Router](https://tanstack.com/router)** — routing por archivos en `src/routes/`
- **React 19** + **TypeScript**
- **Tailwind CSS v4** + componentes **shadcn/ui** (Radix)
- **Vite 8** con **Nitro** para el build del servidor
- **[Bun](https://bun.sh)** como package manager (`bun.lock`)

## Requisitos

- Node.js 20+ (o Bun 1.1+)

## Scripts

```bash
bun install        # instalar dependencias (o: npm install)

bun run dev        # servidor de desarrollo → http://localhost:8080
bun run build      # build de producción (.output/)
bun run preview    # previsualizar el build
bun run lint       # ESLint
bun run format     # Prettier
```

> Los scripts usan `vite`; podés reemplazar `bun run` por `npm run` si no tenés Bun.

## Autenticación

Login con **JWT** (expiración 12hs) contra un backend **ORDS + APEX** en Oracle.
El cliente vive en `src/lib/auth.tsx`; el backend PL/SQL en [backend/](backend/).

La URL base se configura con `VITE_API_URL`:

```bash
# .env
VITE_API_URL=https://<host>/ords/<schema>
```

Endpoints que consume:

- `POST /auth/login` — recibe `{ username, password }`, devuelve `{ token, user: { username } }`.
- `GET /auth/me` — valida el token (`Authorization: Bearer <token>`); se usa al
  recargar para comprobar que la sesión sigue vigente.

El token se persiste en `localStorage`; si expiró, se limpia y vuelve al login.

Si `VITE_API_URL` está vacía, se usa un **login local** de prueba (cualquier
usuario/contraseña) para probar la app sin backend.

### Backend

El backend de autenticación (paquetes JWT, validación contra usuarios APEX y
handlers REST ORDS) está en **[backend/](backend/)**:

- [backend/login.sql](backend/login.sql) — instalación completa en un script.
- [backend/README.md](backend/README.md) — instalación, requisitos y CORS.
- [backend/GUIA.md](backend/GUIA.md) — guía para extender el backend (nuevos endpoints).

## Estructura

```
backend/                # backend de auth: ORDS + APEX + JWT (login.sql, GUIA.md)
public/                 # logo, iconos PWA (favicon, apple-touch, icon-192/512), manifest
src/
  routes/               # rutas (file-based): index=login, home=alta de lavado, __root=layout
  components/
    ui/                 # componentes shadcn/ui
    aqua-background.tsx # fondo animado (aurora + burbujas)
  lib/                  # auth, theme, utilidades y wrappers de error SSR
  server.ts             # entry SSR con manejo de errores
  styles.css            # design system (tokens oklch) + animaciones de fondo
```

## PWA

Instalable en el celular. Los iconos y el manifest viven en `public/`
(`manifest.webmanifest`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`,
`icon-512.png`) y se generan a partir de `public/logo.png`.

## Pendiente

- Persistir el alta de lavado vía `POST` a la API Oracle (hoy es un stub en
  `src/routes/home.tsx`).
