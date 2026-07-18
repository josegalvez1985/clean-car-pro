# Backend de autenticación — Clean Car (ORDS + APEX + JWT)

Login contra los **usuarios internos de APEX**, con emisión de **JWT HS256**
(expiración **12 horas**) servido por **ORDS** en PL/SQL puro. No hay servidor
Node ni servicios extra: todo vive en la base Oracle.

## Endpoints

| Método | Ruta                              | Body / Header                    | Respuesta                                   |
| ------ | --------------------------------- | -------------------------------- | ------------------------------------------- |
| POST   | `/ords/<schema>/api/auth/login` | `{ "username", "password" }`     | `{ "token", "user": { "username" } }`       |
| GET    | `/ords/<schema>/api/auth/me`    | `Authorization: Bearer <token>`  | `{ "username" }` (401 si expiró/ inválido)  |

`<schema>` es el schema ORDS (según tu URL, `evamar`).

## Archivos

| Archivo               | Uso                                                      |
| --------------------- | -------------------------------------------------------- |
| **`login.sql`** | Instalación completa del backend (paquetes + ORDS).      |
| `GUIA.md`             | Guía detallada: arquitectura, agregar endpoints, debug.  |

## Instalación

Conectado como el **schema habilitado en ORDS**, ejecutar de una vez:

```sql
@login.sql
```

Antes de ejecutar, editá en `login.sql` las constantes marcadas
`>>> CAMBIAR <<<`: el secreto JWT (`cc_jwt.c_secret`), el `c_app_id`/`c_page_id`
de APEX y los orígenes CORS.

> Para extender el backend (nuevos endpoints protegidos, tablas, etc.) seguí
> **[GUIA.md](GUIA.md)**.

### Requisitos previos (una vez, como DBA)

```sql
GRANT EXECUTE ON DBMS_CRYPTO TO <schema>;
-- El schema debe estar habilitado en ORDS:
-- BEGIN ords.enable_schema; COMMIT; END;
```

## Configuración obligatoria

1. **Secreto JWT** — en `01_jwt_pkg.sql`, reemplazá `c_secret` por una cadena
   larga y aleatoria. **No** dejes el valor de ejemplo ni lo commitees.
2. **APP_ID / PAGE_ID** — en `02_auth_pkg.sql`, `c_app_id` (139581) y `c_page_id`
   (9999) ya corresponden al login que compartiste; ajustá si cambian.

## CORS

El frontend corre en otro origen (Vite `:8080` / dominio de la PWA), así que
ORDS debe permitir CORS. Como DBA/ADMIN:

```sql
BEGIN
  ords.set_module_origins_allowed(
    p_module_name => 'cleancar.auth',
    p_origins_allowed => 'http://localhost:8080,https://tu-dominio-pwa'
  );
  COMMIT;
END;
/
```

## Conexión desde el frontend

En el `.env` de la app apuntá `VITE_API_URL` al base path del schema:

```bash
VITE_API_URL=https://<host>/ords/evamar
```

El cliente ([src/lib/auth.tsx](../src/lib/auth.tsx)) llama a `/auth/login` y
valida la sesión al recargar contra `/auth/me`; si el token expiró (12hs),
limpia la sesión y vuelve al login.

## Notas de seguridad

- Servir **siempre sobre HTTPS**: el JWT viaja en el header `Authorization`.
- `is_login_password_valid` requiere una sesión APEX; por eso `cc_auth`
  crea una sesión efímera con `apex_session.create_session` y la borra.
- El token se guarda en `localStorage`. Para mayor seguridad podés migrar a
  cookie `HttpOnly`, pero eso requiere que ORDS y la PWA compartan dominio.
