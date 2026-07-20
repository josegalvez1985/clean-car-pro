# Guía de implementación — Backend Clean Car (ORDS + APEX + JWT)

> **Archivos del backend:**
> [login.sql](login.sql) — autenticación (módulo `cleancar.api`, endpoints `auth/*`).
> [servicios.sql](servicios.sql) — servicios del lavadero (`boxes`, `servicios`,
> `servicios-lavadero`). Se ejecuta **después** de `login.sql`; cuelga del mismo
> módulo, así que hereda el CORS.
>
> Nota: las secciones de abajo describen el diseño con JWT (`cc_jwt`). La
> implementación real en `login.sql` usa **tokens opacos** en la tabla
> `CC_TOKENS` y la función es `cc_auth.usuario_desde_bearer`. El patrón para
> agregar endpoints es el mismo.

Guía de referencia para mantener y **extender** el backend: cómo funciona la
autenticación, cómo agregar endpoints nuevos (protegidos con el mismo token) y
cómo depurar. Pensada para que cualquiera pueda sumar features sin releer todo
el código.

---

## 1. Arquitectura en 30 segundos

```
Frontend (PWA / Vite)                Oracle DB
──────────────────────               ─────────────────────────────
POST /auth/login  ───────────────►   handler ORDS
  { username, password }               └─ cc_auth.login()
                                            ├─ cc_auth.check_credentials()
                                            │    └─ apex_util.is_login_password_valid()
                                            └─ cc_jwt.sign()  ──► JWT (12h)
  ◄──────────────  { token, user }

GET /auth/me  ───────────────────►   handler ORDS
  Authorization: Bearer <jwt>          └─ cc_jwt.verify()  (firma + exp)
  ◄──────────────  { username }
```

- **`cc_jwt`** — firma/verifica JWT HS256 con `DBMS_CRYPTO`. No sabe de negocio.
- **`cc_auth`** — valida credenciales contra usuarios APEX y orquesta el login.
- **Módulo ORDS `cleancar.auth`** — expone los handlers HTTP.

Todo vive en la base; no hay servidor Node ni proceso adicional.

---

## 2. Instalación (resumen)

Ejecutar **una sola vez**, como el schema ORDS (p.ej. `EVAMAR`):

```sql
@login.sql
```

Prerrequisitos (DBA, una vez):

```sql
GRANT EXECUTE ON DBMS_CRYPTO TO <schema>;
BEGIN ords.enable_schema; COMMIT; END;   -- si no estaba habilitado
```

Antes de correr, editar en `login.sql`:

| Constante             | Archivo/paquete | Qué es                                   |
| --------------------- | --------------- | ---------------------------------------- |
| `cc_jwt.c_secret`     | cc_jwt          | Secreto HMAC largo y aleatorio           |
| `cc_auth.c_app_id`    | cc_auth         | APP_ID de la app APEX (login)            |
| `cc_auth.c_page_id`   | cc_auth         | Página de login (9999)                   |
| `origins_allowed`     | bloque CORS     | Orígenes del frontend permitidos         |

> Todo el backend vive en `login.sql` (paquetes `cc_jwt`, `cc_auth` y el
> módulo ORDS). Se ejecuta completo cada vez; los `CREATE OR REPLACE` y el
> `delete_module` previo lo hacen idempotente.

---

## 3. El token JWT

- **Algoritmo:** HS256 (HMAC-SHA256 con `c_secret`).
- **Claims:** `sub` (username en mayúsculas), `iat` (emisión), `exp` (expiración).
- **Expiración:** 12 horas. Se cambia en `cc_jwt.c_ttl_seconds`.
- **Formato:** `base64url(header).base64url(payload).base64url(firma)`.

Rotar el secreto (`c_secret`) **invalida todos los tokens** vigentes: los
usuarios deberán volver a loguearse. Es la forma de "cerrar todas las sesiones".

---

## 4. Cómo agregar un endpoint nuevo protegido

Patrón recomendado: **una función PL/SQL que valida el token** y devuelve el
usuario, reutilizada por cada handler. Agregala una vez a `cc_auth`:

```sql
-- En la spec de cc_auth:
FUNCTION user_from_bearer(p_authorization IN VARCHAR2) RETURN VARCHAR2;

-- En el body de cc_auth:
FUNCTION user_from_bearer(p_authorization IN VARCHAR2) RETURN VARCHAR2 IS
BEGIN
  IF p_authorization IS NULL
     OR INSTR(LOWER(p_authorization), 'bearer ') <> 1 THEN
    RAISE_APPLICATION_ERROR(-20401, 'Falta el token Bearer');
  END IF;
  RETURN cc_jwt.verify(TRIM(SUBSTR(p_authorization, 8)));  -- lanza si inválido/expirado
END user_from_bearer;
```

Luego, un endpoint nuevo (ejemplo: registrar un lavado):

```sql
BEGIN
  -- POST /cleancar/lavados
  ords.define_template(p_module_name => 'cleancar.auth', p_pattern => 'lavados');

  ords.define_handler(
    p_module_name => 'cleancar.auth',
    p_pattern     => 'lavados',
    p_method      => 'POST',
    p_source_type => ords.source_type_plsql,
    p_source      => q'[
DECLARE
  l_user  VARCHAR2(255);
  l_body  CLOB := :body_text;
BEGIN
  l_user := cc_auth.user_from_bearer(:authorization);   -- exige token válido

  APEX_JSON.parse(l_body);
  INSERT INTO lavados (patente, tipo, servicio, precio, fecha, usuario)
  VALUES (
    APEX_JSON.get_varchar2('patente'),
    APEX_JSON.get_varchar2('tipo'),
    APEX_JSON.get_varchar2('servicio'),
    APEX_JSON.get_number('precio'),
    TO_DATE(APEX_JSON.get_varchar2('fecha'), 'YYYY-MM-DD'),
    l_user
  );
  COMMIT;

  OWA_UTIL.status_line(201);
  HTP.p('{"ok":true}');
EXCEPTION
  WHEN OTHERS THEN
    OWA_UTIL.status_line(CASE WHEN SQLCODE = -20401 THEN 401 ELSE 400 END);
    HTP.p('{"error":"' || REPLACE(SQLERRM, '"', '''') || '"}');
END;
    ]'
  );

  -- El header Authorization NO llega solo: declararlo como parámetro.
  ords.define_parameter(
    p_module_name        => 'cleancar.auth',
    p_pattern            => 'lavados',
    p_method             => 'POST',
    p_name               => 'Authorization',
    p_bind_variable_name => 'authorization',
    p_source_type        => 'HEADER',
    p_param_type         => 'STRING',
    p_access_method      => 'IN'
  );
  COMMIT;
END;
/
```

**Reglas de oro al agregar endpoints:**

1. Cada handler que necesite auth **debe** declarar el parámetro
   `Authorization` (HEADER) — ORDS no lo pasa por defecto.
2. Llamá a `cc_auth.user_from_bearer(:authorization)` al inicio; si el token es
   inválido/expiró, lanza `-20401` → devolvé **401**.
3. Devolvé JSON con `HTP.p` y el status con `OWA_UTIL.status_line`.
4. Mapear errores: `-20401` → 401, validación → 400, resto → 500.

Desde el frontend, mandá siempre el header:

```ts
fetch(`${API_BASE_URL}/lavados`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${user.token}`,
  },
  body: JSON.stringify(payload),
});
```

---

## 5. CORS

Cada vez que cambie el dominio del frontend, actualizá los orígenes:

```sql
BEGIN
  ords.set_module_origins_allowed(
    p_module_name     => 'cleancar.auth',
    p_origins_allowed => 'http://localhost:8080,https://tu-dominio-pwa'
  );
  COMMIT;
END;
/
```

Sin esto, el navegador bloquea las llamadas con error CORS (aunque el endpoint
funcione con curl/Postman).

---

## 6. Probar sin frontend

```bash
# Login
curl -X POST https://<host>/ords/evamar/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secreto"}'
# -> {"token":"eyJ...","user":{"username":"ADMIN"}}

# Validar token
curl https://<host>/ords/evamar/api/auth/me \
  -H "Authorization: Bearer eyJ..."
# -> {"username":"ADMIN"}   (o 401 si expiró)
```

Probar los paquetes directo en SQL:

```sql
SET SERVEROUTPUT ON
DECLARE
  l_tok VARCHAR2(4000);
BEGIN
  l_tok := cc_auth.login('admin', 'secreto');
  DBMS_OUTPUT.put_line('token: ' || l_tok);
  DBMS_OUTPUT.put_line('verify: ' || cc_jwt.verify(l_tok));  -- devuelve ADMIN
END;
/
```

---

## 7. Troubleshooting

| Síntoma                                   | Causa probable / solución                                              |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `PLS-00201: DBMS_CRYPTO no declarado`     | Falta `GRANT EXECUTE ON DBMS_CRYPTO TO <schema>` (como DBA).           |
| Login siempre 401 con credenciales OK     | `c_app_id`/`c_page_id` no coinciden con la app APEX real.             |
| 404 al llamar el endpoint                 | Schema no habilitado en ORDS, o base_path/patrón mal escrito.         |
| Error CORS en el navegador (no en curl)   | Falta `set_module_origins_allowed` con el origen del frontend.        |
| `me` da 401 con token recién emitido      | El handler no declara el parámetro `Authorization` (HEADER).          |
| Todos los tokens dejan de servir          | Se cambió `c_secret` (rotación) → re-login. Esperado.                 |
| Token no expira a las 12h                 | Revisá `c_ttl_seconds` y que la hora de la BD (UTC) sea correcta.     |

---

## 8. Checklist de seguridad

- [ ] `c_secret` cambiado por valor largo/aleatorio y fuera del control de versiones.
- [ ] Servir **solo por HTTPS** (el JWT viaja en el header).
- [ ] `origins_allowed` restringido a los dominios reales (no `*`).
- [ ] Considerar cookie `HttpOnly` en vez de `localStorage` si ORDS y la PWA
      comparten dominio (mitiga XSS).
- [ ] Rotar `c_secret` periódicamente y ante cualquier sospecha de fuga.
