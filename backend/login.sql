--------------------------------------------------------------------------------
-- Clean Car — Backend de login / autenticación (ORDS + APEX)
-- (login.sql). Ejecutar de una sola vez, conectado como el schema de la app
-- (p.ej. WKSP_EVAMAR).
--
-- Enfoque (probado en producción): token opaco (SYS_GUID) guardado en la tabla
-- CC_TOKENS con su expiración (12 horas). No usa DBMS_CRYPTO ni JWT firmado,
-- así que NO requiere grants especiales de DBA.
--
-- Validación de credenciales contra los usuarios de APEX vía
-- FIND_SECURITY_GROUP_ID / IS_LOGIN_PASSWORD_VALID.
--
-- ANTES DE EJECUTAR, editá las constantes marcadas con >>> CAMBIAR <<< :
--   * c_workspace  (nombre del workspace APEX, en minúsculas)
--   * origins_allowed (orígenes del frontend, bloque CORS)
--
-- Endpoints resultantes:
--   POST /ords/<schema>/api/auth/login   { username, password }
--   POST /ords/<schema>/api/auth/logout  { token }
--   GET  /ords/<schema>/api/auth/me      Authorization: Bearer <token>
--------------------------------------------------------------------------------

SET DEFINE OFF
SET SERVEROUTPUT ON

PROMPT ============================================================
PROMPT  0/5  Prerrequisito: habilitar el schema en ORDS
PROMPT ============================================================
BEGIN
  ORDS.enable_schema(
    p_enabled             => TRUE,
    p_schema              => SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA'),
    p_url_mapping_type    => 'BASE_PATH',
    p_url_mapping_pattern => LOWER(SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA')),
    p_auto_rest_auth      => FALSE
  );
  COMMIT;
  DBMS_OUTPUT.put_line('ORDS: schema habilitado.');
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.put_line('ORDS enable_schema: ' || SQLERRM);
    DBMS_OUTPUT.put_line('Si es por permisos, ejecutá enable_schema como DBA.');
END;
/

PROMPT ============================================================
PROMPT  1/5  Tabla CC_TOKENS
PROMPT ============================================================
DECLARE
  l_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO l_exists
  FROM user_tables WHERE table_name = 'CC_TOKENS';

  IF l_exists = 0 THEN
    EXECUTE IMMEDIATE q'[
      CREATE TABLE cc_tokens (
        token             VARCHAR2(128) PRIMARY KEY,
        usuario           VARCHAR2(255) NOT NULL,
        fecha_creacion    TIMESTAMP     NOT NULL,
        fecha_expiracion  TIMESTAMP     NOT NULL,
        activo            VARCHAR2(1)   DEFAULT 'S' NOT NULL
                          CHECK (activo IN ('S','N'))
      )
    ]';
    EXECUTE IMMEDIATE
      'CREATE INDEX cc_tokens_usuario_ix ON cc_tokens (usuario, activo)';
    DBMS_OUTPUT.put_line('Tabla CC_TOKENS creada.');
  ELSE
    DBMS_OUTPUT.put_line('Tabla CC_TOKENS ya existe.');
  END IF;
END;
/

PROMPT ============================================================
PROMPT  2/5  Paquete cc_auth (login / logout / validación de token)
PROMPT ============================================================

CREATE OR REPLACE PACKAGE cc_auth AS
  -- Vencimiento del token en segundos (12 horas).
  c_ttl_seconds CONSTANT PLS_INTEGER := 12 * 60 * 60;

  -- Valida usuario/clave contra los usuarios de APEX (por workspace).
  FUNCTION credenciales_validas(
    p_usuario  IN VARCHAR2,
    p_password IN VARCHAR2
  ) RETURN BOOLEAN;

  -- Devuelve el usuario dueño de un token activo y no vencido, o NULL.
  FUNCTION validar_token(
    p_token IN VARCHAR2
  ) RETURN VARCHAR2;

  -- Extrae el token del header "Bearer xxx" y lo valida. NULL si inválido.
  FUNCTION usuario_desde_bearer(
    p_authorization IN VARCHAR2
  ) RETURN VARCHAR2;

  -- true si el usuario (tal como devuelve validar_token, en MAYÚSCULAS)
  -- puede editar/eliminar registros. Lista corta a propósito: JOSEG y EVAC
  -- son los únicos habilitados; el resto del personal solo da de alta.
  FUNCTION es_admin(
    p_usuario IN VARCHAR2
  ) RETURN BOOLEAN;

  -- Handlers HTTP (escriben JSON directamente en la respuesta).
  PROCEDURE login(
    p_usuario  IN VARCHAR2,
    p_password IN VARCHAR2
  );

  PROCEDURE logout(
    p_token IN VARCHAR2
  );
END cc_auth;
/

CREATE OR REPLACE PACKAGE BODY cc_auth AS

  -- >>> CAMBIAR <<< : nombre del workspace APEX, tal como lo guarda APEX
  -- (MAYÚSCULAS). Verificalo con:
  --   SELECT workspace_name FROM apex_workspaces;
  -- Si este nombre no coincide, el login devuelve 401 siempre, aun con
  -- credenciales correctas.
  c_workspace CONSTANT VARCHAR2(255) := 'EVAMAR';

  FUNCTION generar_token RETURN VARCHAR2 IS
  BEGIN
    RETURN UPPER(RAWTOHEX(SYS_GUID()) || RAWTOHEX(SYS_GUID()));
  END generar_token;

  FUNCTION credenciales_validas(
    p_usuario  IN VARCHAR2,
    p_password IN VARCHAR2
  ) RETURN BOOLEAN IS
  BEGIN
    -- set_workspace es obligatorio antes de is_login_password_valid: sin un
    -- workspace activo la validación devuelve FALSE siempre.
    APEX_UTIL.SET_WORKSPACE(p_workspace => c_workspace);
    RETURN APEX_UTIL.IS_LOGIN_PASSWORD_VALID(
             p_username => UPPER(p_usuario),
             p_password => p_password
           );
  END credenciales_validas;

  FUNCTION validar_token(
    p_token IN VARCHAR2
  ) RETURN VARCHAR2 IS
    l_usuario VARCHAR2(255);
  BEGIN
    SELECT usuario
      INTO l_usuario
      FROM cc_tokens
     WHERE token = UPPER(p_token)
       AND activo = 'S'
       AND fecha_expiracion > SYSTIMESTAMP;
    RETURN l_usuario;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RETURN NULL;
  END validar_token;

  FUNCTION usuario_desde_bearer(
    p_authorization IN VARCHAR2
  ) RETURN VARCHAR2 IS
  BEGIN
    IF p_authorization IS NULL
       OR INSTR(LOWER(p_authorization), 'bearer ') <> 1 THEN
      RETURN NULL;
    END IF;
    RETURN validar_token(TRIM(SUBSTR(p_authorization, 8)));
  END usuario_desde_bearer;

  FUNCTION es_admin(
    p_usuario IN VARCHAR2
  ) RETURN BOOLEAN IS
  BEGIN
    RETURN UPPER(p_usuario) IN ('JOSEG', 'EVAC');
  END es_admin;

  PROCEDURE login(
    p_usuario  IN VARCHAR2,
    p_password IN VARCHAR2
  ) IS
    l_token VARCHAR2(128);
    l_exp   TIMESTAMP;
  BEGIN
    OWA_UTIL.mime_header('application/json', FALSE);
    OWA_UTIL.http_header_close;

    IF p_usuario IS NULL OR p_password IS NULL THEN
      OWA_UTIL.status_line(400);
      APEX_JSON.open_object;
      APEX_JSON.write('success', FALSE);
      APEX_JSON.write('message', 'Usuario y contrasena son obligatorios');
      APEX_JSON.close_object;
      RETURN;
    END IF;

    IF credenciales_validas(p_usuario, p_password) THEN
      l_token := generar_token;
      l_exp   := SYSTIMESTAMP + NUMTODSINTERVAL(c_ttl_seconds, 'SECOND');

      -- Invalidar sesiones anteriores del mismo usuario.
      UPDATE cc_tokens
         SET activo = 'N'
       WHERE usuario = UPPER(p_usuario)
         AND activo = 'S';

      INSERT INTO cc_tokens (
        token, usuario, fecha_creacion, fecha_expiracion, activo
      ) VALUES (
        l_token, UPPER(p_usuario), SYSTIMESTAMP, l_exp, 'S'
      );
      COMMIT;

      -- Respuesta compatible con el frontend: { token, user: { username } }.
      APEX_JSON.open_object;
      APEX_JSON.write('token', l_token);
      APEX_JSON.open_object('user');
      APEX_JSON.write('username', UPPER(p_usuario));
      APEX_JSON.close_object;
      APEX_JSON.write('expira',
        TO_CHAR(l_exp, 'YYYY-MM-DD"T"HH24:MI:SS'));
      APEX_JSON.close_object;
    ELSE
      OWA_UTIL.status_line(401);
      APEX_JSON.open_object;
      APEX_JSON.write('success', FALSE);
      APEX_JSON.write('error', 'Usuario o contrasena incorrectos');
      APEX_JSON.close_object;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      ROLLBACK;
      OWA_UTIL.status_line(500);
      APEX_JSON.open_object;
      APEX_JSON.write('success', FALSE);
      APEX_JSON.write('error', 'Error: ' || SQLERRM);
      APEX_JSON.close_object;
  END login;

  PROCEDURE logout(
    p_token IN VARCHAR2
  ) IS
    l_filas NUMBER;
  BEGIN
    OWA_UTIL.mime_header('application/json', FALSE);
    OWA_UTIL.http_header_close;

    UPDATE cc_tokens
       SET activo = 'N'
     WHERE token = UPPER(p_token)
       AND activo = 'S';
    l_filas := SQL%ROWCOUNT;
    COMMIT;

    APEX_JSON.open_object;
    APEX_JSON.write('success', l_filas > 0);
    APEX_JSON.write('message',
      CASE WHEN l_filas > 0 THEN 'Sesion cerrada'
           ELSE 'Token no encontrado o ya inactivo' END);
    APEX_JSON.close_object;
  END logout;

END cc_auth;
/

PROMPT ============================================================
PROMPT  3/5  Módulo REST ORDS (auth/login, auth/logout, auth/me)
PROMPT ============================================================

BEGIN
  BEGIN
    ords.delete_module(p_module_name => 'cleancar.api');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  ords.define_module(
    p_module_name    => 'cleancar.api',
    p_base_path      => 'api/',
    p_items_per_page => 0,
    p_status         => 'PUBLISHED',
    p_comments       => 'Clean Car — autenticación por token'
  );

  ----------------------------------------------------------------------------
  -- POST /api/auth/login
  ----------------------------------------------------------------------------
  ords.define_template(
    p_module_name => 'cleancar.api',
    p_pattern     => 'auth/login'
  );
  ords.define_handler(
    p_module_name => 'cleancar.api',
    p_pattern     => 'auth/login',
    p_method      => 'POST',
    p_source_type => ords.source_type_plsql,
    p_source      => q'[
BEGIN
  APEX_JSON.parse(:body_text);
  cc_auth.login(
    p_usuario  => APEX_JSON.get_varchar2(p_path => 'username'),
    p_password => APEX_JSON.get_varchar2(p_path => 'password')
  );
END;
    ]'
  );

  ----------------------------------------------------------------------------
  -- POST /api/auth/logout
  ----------------------------------------------------------------------------
  ords.define_template(
    p_module_name => 'cleancar.api',
    p_pattern     => 'auth/logout'
  );
  ords.define_handler(
    p_module_name => 'cleancar.api',
    p_pattern     => 'auth/logout',
    p_method      => 'POST',
    p_source_type => ords.source_type_plsql,
    p_source      => q'[
BEGIN
  APEX_JSON.parse(:body_text);
  cc_auth.logout(p_token => APEX_JSON.get_varchar2(p_path => 'token'));
END;
    ]'
  );

  ----------------------------------------------------------------------------
  -- GET /api/auth/me   (valida el Bearer token)
  ----------------------------------------------------------------------------
  ords.define_template(
    p_module_name => 'cleancar.api',
    p_pattern     => 'auth/me'
  );
  ords.define_handler(
    p_module_name => 'cleancar.api',
    p_pattern     => 'auth/me',
    p_method      => 'GET',
    p_source_type => ords.source_type_plsql,
    p_source      => q'[
DECLARE
  l_user VARCHAR2(255);
BEGIN
  OWA_UTIL.mime_header('application/json', FALSE);
  OWA_UTIL.http_header_close;
  l_user := cc_auth.usuario_desde_bearer(:authorization);
  IF l_user IS NULL THEN
    OWA_UTIL.status_line(401);
    APEX_JSON.open_object;
    APEX_JSON.write('error', 'Token invalido o expirado');
    APEX_JSON.close_object;
  ELSE
    APEX_JSON.open_object;
    APEX_JSON.write('username', l_user);
    APEX_JSON.close_object;
  END IF;
END;
    ]'
  );
  ords.define_parameter(
    p_module_name        => 'cleancar.api',
    p_pattern            => 'auth/me',
    p_method             => 'GET',
    p_name               => 'Authorization',
    p_bind_variable_name => 'authorization',
    p_source_type        => 'HEADER',
    p_param_type         => 'STRING',
    p_access_method      => 'IN'
  );

  COMMIT;
END;
/

PROMPT ============================================================
PROMPT  4/5  CORS (ajustá los orígenes permitidos)
PROMPT ============================================================
BEGIN
  -- >>> CAMBIAR <<< : orígenes del frontend (GitHub Pages + Vite local + IPs de red).
  -- Solo esquema+host+puerto, sin path. Las IPs de LAN son para abrir la app
  -- desde otro dispositivo; si cambian por DHCP hay que actualizarlas acá.
  ords.set_module_origins_allowed(
    p_module_name     => 'cleancar.api',
    p_origins_allowed => 'https://josegalvez1985.github.io,http://localhost:8080,http://192.168.4.118:8080,http://172.30.144.1:8080'
  );
  COMMIT;
END;
/

PROMPT
PROMPT  5/5  Listo. Endpoints:
PROMPT    POST /ords/<schema>/api/auth/login
PROMPT    POST /ords/<schema>/api/auth/logout
PROMPT    GET  /ords/<schema>/api/auth/me
PROMPT
