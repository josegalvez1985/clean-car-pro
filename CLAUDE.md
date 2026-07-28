# Clean Car — contexto para Claude

PWA de gestión de un lavadero. Migración de una app Oracle APEX a React contra
el mismo backend Oracle/ORDS.

**Leé este archivo y nada más para arrancar.** No hace falta abrir README.md ni
recorrer `src/` para tomar contexto: lo que sigue es todo lo que se necesita
antes de la primera edición.

## Stack

TanStack Start (SPA, sin SSR) · React 19 · TypeScript · Tailwind v4 +
shadcn/ui · Vite 8 · Bun. Backend: paquetes PL/SQL expuestos por ORDS.

## Mapa

| Dónde                  | Qué                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `src/routes/`          | Páginas (file-based): `index`=login, `home`, `boxes`, `servicios`, `ventas`, `cuenta`    |
| `src/lib/api.ts`       | `request()` — **único** punto de fetch; agrega el Bearer y expulsa al login ante 401/403 |
| `src/lib/servicios.ts` | Cliente de `BOX_LAV`, `SERVICIOS_LAV`, `SERVICIOS_LAVADERO`                              |
| `src/lib/auth.tsx`     | Sesión (token opaco en `localStorage`), `esAdmin()`                                      |
| `src/lib/biometric.ts` | WebAuthn + credenciales recordadas                                                       |
| `backend/*.sql`        | Un archivo por dominio: paquete PL/SQL + endpoints ORDS                                  |

## Reglas que ya costaron caro

1. **Los agregados los calcula el backend.** Nunca `.reduce()` ni `.length`
   sobre la respuesta de un endpoint paginado: es una página, no el total.
   Excepción: el buscador local de `useTabla`, y ahí la etiqueta dice
   "(filtrado)".
2. **`login.sql` se ejecuta primero.** Todos los paquetes compilan contra
   `CC_AUTH`; con uno viejo en la base el body falla con `PLS-00302` y el
   `CREATE OR REPLACE` deja inválido lo que funcionaba.
3. **La hora la manda el cliente** (`p_hora`, `HH24:MI`), nunca `SYSDATE`: el
   servidor está en otra zona horaria.
4. **`ORDS.DEFINE_MODULE` no acepta `p_origins_allowed`** en esta instancia
   (`PLS-00306`). El CORS va solo por `SET_MODULE_ORIGINS_ALLOWED`.
5. **No borrar estado del usuario ante un error genérico.** Distinguir "el
   backend rechazó" de "no hubo red" antes de hacer un `clear*()`: ver
   `CredencialesInvalidasError` en `auth.tsx`.
6. **Ante el primer error de un script SQL, auditar el script entero** antes de
   responder. Diagnosticar de a un error por vez es una iteración por error con
   el usuario esperando.

## Antes de dar algo por terminado

```bash
npx tsc --noEmit
npx prettier --write <archivos>
npx eslint <archivos>
```

Sin navegador ni Playwright. **Los `.sql` los ejecuta el usuario**: al entregar
uno, decir explícitamente qué correr y en qué orden, y pedir la verificación:

```sql
SELECT object_name, object_type, status FROM user_objects
 WHERE object_type IN ('PACKAGE', 'PACKAGE BODY') AND status = 'INVALID';
```

Un `.sql` escrito y no ejecutado es un error latente que reaparece meses
después sin contexto.

## Detalle

- Cómo migrar una pantalla nueva, contrato del backend y convenciones de UI:
  [GUIA-CRUD.md](GUIA-CRUD.md) — la tabla de §5 lista los errores ya cometidos.
- Arquitectura de auth y troubleshooting de ORDS: [backend/GUIA.md](backend/GUIA.md).
