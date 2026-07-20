--------------------------------------------------------------------------------
-- SERVICIOS_LAV + SERVICIOS_LAVADERO (página APEX 14) — paquete CRUD +
-- endpoints ORDS.
-- Ejecutar completo como el esquema de la app (WKSP_EVAMAR).
-- Requiere login.sql (paquete CC_AUTH).
--
-- SERVICIOS_LAV     : catálogo de servicios (id_servicio, descripcion, precio).
-- SERVICIOS_LAVADERO: movimientos (id_box, fecha, id_servicio, comentario, precio).
--                     PK por IDENTITY; todas las columnas NOT NULL.
--
-- === 1) PAQUETE PKG_SERVICIOS_CLEANCAR =====================================
--------------------------------------------------------------------------------

CREATE OR REPLACE PACKAGE PKG_SERVICIOS_CLEANCAR AS

  -- Catálogo SERVICIOS_LAV (alimenta el selector de servicio).
  PROCEDURE LISTAR_CATALOGO(p_token IN VARCHAR2);

  -- Movimientos SERVICIOS_LAVADERO. p_pagina arranca en 1.
  PROCEDURE LISTAR(
      p_token IN VARCHAR2, p_fecha_desde IN VARCHAR2 DEFAULT NULL,
      p_fecha_hasta IN VARCHAR2 DEFAULT NULL, p_id_box IN VARCHAR2 DEFAULT NULL,
      p_pagina IN VARCHAR2 DEFAULT NULL, p_tam_pagina IN VARCHAR2 DEFAULT NULL,
      p_todo_periodo IN VARCHAR2 DEFAULT NULL);
  PROCEDURE OBTENER(p_token IN VARCHAR2, p_id IN NUMBER);
  PROCEDURE INSERTAR(
      p_token IN VARCHAR2, p_id_box IN NUMBER, p_fecha IN VARCHAR2,
      p_id_servicio IN NUMBER, p_comentario IN VARCHAR2, p_precio IN NUMBER);
  PROCEDURE ACTUALIZAR(
      p_token IN VARCHAR2, p_id IN NUMBER, p_id_box IN NUMBER, p_fecha IN VARCHAR2,
      p_id_servicio IN NUMBER, p_comentario IN VARCHAR2, p_precio IN NUMBER);
  PROCEDURE ELIMINAR(p_token IN VARCHAR2, p_id IN NUMBER);

END PKG_SERVICIOS_CLEANCAR;
/

CREATE OR REPLACE PACKAGE BODY PKG_SERVICIOS_CLEANCAR AS

  PROCEDURE p_error(p_status IN NUMBER, p_reason IN VARCHAR2, p_message IN VARCHAR2) IS
  BEGIN
    OWA_UTIL.STATUS_LINE(p_status, p_reason, FALSE);
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', FALSE);
    APEX_JSON.WRITE('message', p_message);
    APEX_JSON.CLOSE_OBJECT;
  END p_error;

  FUNCTION f_usuario(p_token IN VARCHAR2) RETURN VARCHAR2 IS
  BEGIN
    RETURN CC_AUTH.VALIDAR_TOKEN(p_token);
  END f_usuario;

  --------------------------------------------------------------------------
  -- LISTAR_CATALOGO (SERVICIOS_LAV)
  --------------------------------------------------------------------------
  PROCEDURE LISTAR_CATALOGO(p_token IN VARCHAR2) IS
    l_usuario VARCHAR2(255);
  BEGIN
    l_usuario := f_usuario(p_token);
    IF l_usuario IS NULL THEN
      p_error(401, 'Unauthorized', 'Token invalido o expirado');
      RETURN;
    END IF;

    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.OPEN_ARRAY('data');
    -- Solo servicios activos: el selector del alta no debe ofrecer los dados
    -- de baja en el catálogo (página 6).
    FOR r IN (
        SELECT id_servicio, descripcion, estado, precio
          FROM servicios_lav
         WHERE estado = 'A'
         ORDER BY descripcion
    ) LOOP
      APEX_JSON.OPEN_OBJECT;
      APEX_JSON.WRITE('id_servicio', r.id_servicio);
      APEX_JSON.WRITE('descripcion', r.descripcion);
      APEX_JSON.WRITE('estado', r.estado);
      APEX_JSON.WRITE('precio', r.precio);
      APEX_JSON.CLOSE_OBJECT;
    END LOOP;
    APEX_JSON.CLOSE_ARRAY;
    APEX_JSON.CLOSE_OBJECT;
  EXCEPTION
    WHEN OTHERS THEN
      p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
  END LISTAR_CATALOGO;

  --------------------------------------------------------------------------
  -- LISTAR movimientos, paginado. p_fecha_desde/p_fecha_hasta (YYYY-MM-DD) e
  -- p_id_box filtran; NULL = sin ese filtro. Si no se pasa ningún filtro de
  -- fecha, trae solo el mes en curso (evita cargar toda la tabla) — salvo que
  -- p_todo_periodo='S' (p.ej. "últimos movimientos" del home, que quiere los
  -- N más recientes sin importar el mes).
  -- p_pagina arranca en 1; p_tam_pagina default 30.
  --------------------------------------------------------------------------
  PROCEDURE LISTAR(
      p_token IN VARCHAR2, p_fecha_desde IN VARCHAR2 DEFAULT NULL,
      p_fecha_hasta IN VARCHAR2 DEFAULT NULL, p_id_box IN VARCHAR2 DEFAULT NULL,
      p_pagina IN VARCHAR2 DEFAULT NULL, p_tam_pagina IN VARCHAR2 DEFAULT NULL,
      p_todo_periodo IN VARCHAR2 DEFAULT NULL) IS
    l_usuario     VARCHAR2(255);
    l_desde       DATE;
    l_hasta       DATE;
    l_id_box      NUMBER := NULL;
    l_pagina      PLS_INTEGER := 1;
    l_tam_pagina  PLS_INTEGER := 30;
    l_total       NUMBER;
  BEGIN
    l_usuario := f_usuario(p_token);
    IF l_usuario IS NULL THEN
      p_error(401, 'Unauthorized', 'Token invalido o expirado');
      RETURN;
    END IF;

    BEGIN
      l_desde := CASE WHEN p_fecha_desde IS NOT NULL THEN TO_DATE(p_fecha_desde, 'YYYY-MM-DD') END;
      l_hasta := CASE WHEN p_fecha_hasta IS NOT NULL THEN TO_DATE(p_fecha_hasta, 'YYYY-MM-DD') END;
    EXCEPTION
      WHEN OTHERS THEN
        p_error(400, 'Bad Request', 'Fecha invalida (usar YYYY-MM-DD)');
        RETURN;
    END;

    -- Sin filtro de fecha ni pedido explícito de todo el período: acotar al
    -- mes en curso por defecto.
    IF l_desde IS NULL AND l_hasta IS NULL AND NVL(UPPER(p_todo_periodo), 'N') != 'S' THEN
      l_desde := TRUNC(SYSDATE, 'MM');
      l_hasta := LAST_DAY(SYSDATE);
    END IF;

    IF p_id_box IS NOT NULL THEN
      BEGIN
        l_id_box := TO_NUMBER(p_id_box);
      EXCEPTION
        WHEN OTHERS THEN
          p_error(400, 'Bad Request', 'id_box invalido');
          RETURN;
      END;
    END IF;

    IF p_pagina IS NOT NULL THEN
      l_pagina := GREATEST(TO_NUMBER(p_pagina), 1);
    END IF;
    IF p_tam_pagina IS NOT NULL THEN
      l_tam_pagina := LEAST(GREATEST(TO_NUMBER(p_tam_pagina), 1), 200);
    END IF;

    SELECT COUNT(*) INTO l_total
      FROM servicios_lavadero sl
     WHERE (l_desde IS NULL OR sl.fecha >= l_desde)
       AND (l_hasta IS NULL OR sl.fecha < l_hasta + 1)
       AND (l_id_box IS NULL OR sl.id_box = l_id_box);

    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.WRITE('total', l_total);
    APEX_JSON.OPEN_ARRAY('data');
    FOR r IN (
        SELECT sl.id_servicio_lavadero, sl.id_box, b.descripcion AS box,
               sl.fecha, sl.id_servicio, s.descripcion AS servicio,
               sl.comentario, sl.precio
          FROM servicios_lavadero sl
          JOIN box_lav       b ON b.id_box      = sl.id_box
          JOIN servicios_lav s ON s.id_servicio = sl.id_servicio
         WHERE (l_desde IS NULL OR sl.fecha >= l_desde)
           AND (l_hasta IS NULL OR sl.fecha < l_hasta + 1)
           AND (l_id_box IS NULL OR sl.id_box = l_id_box)
         ORDER BY sl.fecha DESC, sl.id_servicio_lavadero DESC
         OFFSET (l_pagina - 1) * l_tam_pagina ROWS FETCH NEXT l_tam_pagina ROWS ONLY
    ) LOOP
      APEX_JSON.OPEN_OBJECT;
      APEX_JSON.WRITE('id_servicio_lavadero', r.id_servicio_lavadero);
      APEX_JSON.WRITE('id_box', r.id_box);
      APEX_JSON.WRITE('box', r.box);
      APEX_JSON.WRITE('fecha', TO_CHAR(r.fecha, 'YYYY-MM-DD'));
      APEX_JSON.WRITE('id_servicio', r.id_servicio);
      APEX_JSON.WRITE('servicio', r.servicio);
      APEX_JSON.WRITE('comentario', r.comentario);
      APEX_JSON.WRITE('precio', r.precio);
      APEX_JSON.CLOSE_OBJECT;
    END LOOP;
    APEX_JSON.CLOSE_ARRAY;
    APEX_JSON.CLOSE_OBJECT;
  EXCEPTION
    WHEN OTHERS THEN
      p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
  END LISTAR;

  --------------------------------------------------------------------------
  -- OBTENER
  --------------------------------------------------------------------------
  PROCEDURE OBTENER(p_token IN VARCHAR2, p_id IN NUMBER) IS
    l_usuario VARCHAR2(255);
    l_row     servicios_lavadero%ROWTYPE;
  BEGIN
    l_usuario := f_usuario(p_token);
    IF l_usuario IS NULL THEN
      p_error(401, 'Unauthorized', 'Token invalido o expirado');
      RETURN;
    END IF;

    BEGIN
      SELECT * INTO l_row
        FROM servicios_lavadero
       WHERE id_servicio_lavadero = p_id;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        p_error(404, 'Not Found', 'Servicio no encontrado');
        RETURN;
    END;

    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.OPEN_OBJECT('data');
    APEX_JSON.WRITE('id_servicio_lavadero', l_row.id_servicio_lavadero);
    APEX_JSON.WRITE('id_box', l_row.id_box);
    APEX_JSON.WRITE('fecha', TO_CHAR(l_row.fecha, 'YYYY-MM-DD'));
    APEX_JSON.WRITE('id_servicio', l_row.id_servicio);
    APEX_JSON.WRITE('comentario', l_row.comentario);
    APEX_JSON.WRITE('precio', l_row.precio);
    APEX_JSON.CLOSE_OBJECT;
    APEX_JSON.CLOSE_OBJECT;
  EXCEPTION
    WHEN OTHERS THEN
      p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
  END OBTENER;

  --------------------------------------------------------------------------
  -- INSERTAR (id por IDENTITY)
  --------------------------------------------------------------------------
  PROCEDURE INSERTAR(
      p_token IN VARCHAR2, p_id_box IN NUMBER, p_fecha IN VARCHAR2,
      p_id_servicio IN NUMBER, p_comentario IN VARCHAR2, p_precio IN NUMBER) IS
    l_usuario    VARCHAR2(255);
    l_id         servicios_lavadero.id_servicio_lavadero%TYPE;
    l_comentario servicios_lavadero.comentario%TYPE;
  BEGIN
    l_usuario := f_usuario(p_token);
    IF l_usuario IS NULL THEN
      p_error(401, 'Unauthorized', 'Token invalido o expirado');
      RETURN;
    END IF;

    -- COMENTARIO es NOT NULL en la tabla pero opcional en el formulario: si
    -- no lo escriben, se guarda la descripción del servicio.
    IF p_id_box IS NULL OR p_fecha IS NULL OR p_id_servicio IS NULL OR p_precio IS NULL THEN
      p_error(400, 'Bad Request', 'Faltan datos obligatorios');
      RETURN;
    END IF;

    l_comentario := p_comentario;
    IF l_comentario IS NULL THEN
      BEGIN
        SELECT descripcion INTO l_comentario FROM servicios_lav WHERE id_servicio = p_id_servicio;
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          p_error(400, 'Bad Request', 'El servicio no existe');
          RETURN;
      END;
    END IF;

    INSERT INTO servicios_lavadero (id_box, fecha, id_servicio, comentario, precio)
    VALUES (p_id_box, TO_DATE(p_fecha, 'YYYY-MM-DD'), p_id_servicio, l_comentario, p_precio)
    RETURNING id_servicio_lavadero INTO l_id;
    COMMIT;

    OWA_UTIL.STATUS_LINE(201, 'Created', FALSE);
    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.WRITE('message', 'Servicio registrado');
    APEX_JSON.WRITE('id_servicio_lavadero', l_id);
    APEX_JSON.CLOSE_OBJECT;
  EXCEPTION
    WHEN OTHERS THEN
      ROLLBACK;
      IF SQLCODE = -2291 THEN
        p_error(400, 'Bad Request', 'El box o el servicio no existe');
      ELSE
        p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
      END IF;
  END INSERTAR;

  --------------------------------------------------------------------------
  -- ACTUALIZAR
  --------------------------------------------------------------------------
  PROCEDURE ACTUALIZAR(
      p_token IN VARCHAR2, p_id IN NUMBER, p_id_box IN NUMBER, p_fecha IN VARCHAR2,
      p_id_servicio IN NUMBER, p_comentario IN VARCHAR2, p_precio IN NUMBER) IS
    l_usuario    VARCHAR2(255);
    l_comentario servicios_lavadero.comentario%TYPE;
  BEGIN
    l_usuario := f_usuario(p_token);
    IF l_usuario IS NULL THEN
      p_error(401, 'Unauthorized', 'Token invalido o expirado');
      RETURN;
    END IF;
    IF NOT CC_AUTH.ES_ADMIN(l_usuario) THEN
      p_error(403, 'Forbidden', 'No tenes permiso para modificar registros');
      RETURN;
    END IF;

    IF p_id_box IS NULL OR p_fecha IS NULL OR p_id_servicio IS NULL OR p_precio IS NULL THEN
      p_error(400, 'Bad Request', 'Faltan datos obligatorios');
      RETURN;
    END IF;

    -- Mismo default que INSERTAR: sin comentario, se usa la descripción del
    -- servicio.
    l_comentario := p_comentario;
    IF l_comentario IS NULL THEN
      BEGIN
        SELECT descripcion INTO l_comentario FROM servicios_lav WHERE id_servicio = p_id_servicio;
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          p_error(400, 'Bad Request', 'El servicio no existe');
          RETURN;
      END;
    END IF;

    UPDATE servicios_lavadero
       SET id_box      = p_id_box,
           fecha       = TO_DATE(p_fecha, 'YYYY-MM-DD'),
           id_servicio = p_id_servicio,
           comentario  = l_comentario,
           precio      = p_precio
     WHERE id_servicio_lavadero = p_id;

    IF SQL%ROWCOUNT = 0 THEN
      ROLLBACK;
      p_error(404, 'Not Found', 'Servicio no encontrado');
      RETURN;
    END IF;
    COMMIT;

    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.WRITE('message', 'Servicio actualizado');
    APEX_JSON.CLOSE_OBJECT;
  EXCEPTION
    WHEN OTHERS THEN
      ROLLBACK;
      IF SQLCODE = -2291 THEN
        p_error(400, 'Bad Request', 'El box o el servicio no existe');
      ELSE
        p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
      END IF;
  END ACTUALIZAR;

  --------------------------------------------------------------------------
  -- ELIMINAR
  --------------------------------------------------------------------------
  PROCEDURE ELIMINAR(p_token IN VARCHAR2, p_id IN NUMBER) IS
    l_usuario VARCHAR2(255);
  BEGIN
    l_usuario := f_usuario(p_token);
    IF l_usuario IS NULL THEN
      p_error(401, 'Unauthorized', 'Token invalido o expirado');
      RETURN;
    END IF;
    IF NOT CC_AUTH.ES_ADMIN(l_usuario) THEN
      p_error(403, 'Forbidden', 'No tenes permiso para eliminar registros');
      RETURN;
    END IF;

    DELETE FROM servicios_lavadero WHERE id_servicio_lavadero = p_id;

    IF SQL%ROWCOUNT = 0 THEN
      ROLLBACK;
      p_error(404, 'Not Found', 'Servicio no encontrado');
      RETURN;
    END IF;
    COMMIT;

    APEX_JSON.OPEN_OBJECT;
    APEX_JSON.WRITE('success', TRUE);
    APEX_JSON.WRITE('message', 'Servicio eliminado');
    APEX_JSON.CLOSE_OBJECT;
  EXCEPTION
    WHEN OTHERS THEN
      ROLLBACK;
      p_error(500, 'Internal Server Error', 'Error: ' || SQLERRM);
  END ELIMINAR;

END PKG_SERVICIOS_CLEANCAR;
/

--------------------------------------------------------------------------------
-- === 2) ENDPOINTS ORDS =====================================================
--
--   GET    /api/servicios                  -> catálogo SERVICIOS_LAV
--   GET    /api/servicios-lavadero         -> listar movimientos, paginado
--                                              (?fecha_desde=&fecha_hasta=&id_box=&pagina=&tam_pagina=&todo_periodo=S)
--                                              sin fecha_desde/hasta: mes en curso,
--                                              salvo todo_periodo=S (ignora ese default)
--   GET    /api/servicios-lavadero/:id     -> obtener
--   POST   /api/servicios-lavadero         -> insertar
--   PUT    /api/servicios-lavadero/:id     -> actualizar
--   DELETE /api/servicios-lavadero/:id     -> eliminar
--------------------------------------------------------------------------------

BEGIN
  BEGIN ORDS.DELETE_HANDLER('cleancar.api', 'servicios', 'GET');                  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ORDS.DELETE_HANDLER('cleancar.api', 'servicios-lavadero', 'GET');         EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ORDS.DELETE_HANDLER('cleancar.api', 'servicios-lavadero', 'POST');        EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ORDS.DELETE_HANDLER('cleancar.api', 'servicios-lavadero/:id', 'GET');     EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ORDS.DELETE_HANDLER('cleancar.api', 'servicios-lavadero/:id', 'PUT');     EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ORDS.DELETE_HANDLER('cleancar.api', 'servicios-lavadero/:id', 'DELETE');  EXCEPTION WHEN OTHERS THEN NULL; END;

  ----------------------------------------------------------------------------
  -- /servicios  (catálogo)
  ----------------------------------------------------------------------------
  BEGIN
    ORDS.DEFINE_TEMPLATE(p_module_name => 'cleancar.api', p_pattern => 'servicios',
        p_priority => 0, p_etag_type => 'HASH', p_comments => NULL);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  ORDS.DEFINE_HANDLER(
      p_module_name => 'cleancar.api', p_pattern => 'servicios', p_method => 'GET',
      p_source_type => 'plsql/block',
      p_source      => q'~
DECLARE l_token VARCHAR2(256); l_pos PLS_INTEGER;
BEGIN
    OWA_UTIL.MIME_HEADER('application/json', FALSE);
    OWA_UTIL.HTTP_HEADER_CLOSE;
    l_token := :authorization;
    IF l_token IS NOT NULL THEN
        l_pos := INSTR(UPPER(l_token), 'BEARER ');
        IF l_pos > 0 THEN l_token := TRIM(SUBSTR(l_token, l_pos + 7)); END IF;
    END IF;
    PKG_SERVICIOS_CLEANCAR.LISTAR_CATALOGO(p_token => l_token);
END;
~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'cleancar.api', p_pattern => 'servicios', p_method => 'GET',
      p_name => 'Authorization', p_bind_variable_name => 'authorization',
      p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');

  ----------------------------------------------------------------------------
  -- /servicios-lavadero
  ----------------------------------------------------------------------------
  BEGIN
    ORDS.DEFINE_TEMPLATE(p_module_name => 'cleancar.api', p_pattern => 'servicios-lavadero',
        p_priority => 0, p_etag_type => 'HASH', p_comments => NULL);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  ORDS.DEFINE_HANDLER(
      p_module_name => 'cleancar.api', p_pattern => 'servicios-lavadero', p_method => 'GET',
      p_source_type => 'plsql/block',
      p_source      => q'~
DECLARE l_token VARCHAR2(256); l_pos PLS_INTEGER;
BEGIN
    OWA_UTIL.MIME_HEADER('application/json', FALSE);
    OWA_UTIL.HTTP_HEADER_CLOSE;
    l_token := :authorization;
    IF l_token IS NOT NULL THEN
        l_pos := INSTR(UPPER(l_token), 'BEARER ');
        IF l_pos > 0 THEN l_token := TRIM(SUBSTR(l_token, l_pos + 7)); END IF;
    END IF;
    PKG_SERVICIOS_CLEANCAR.LISTAR(
        p_token       => l_token,
        p_fecha_desde => :fecha_desde,
        p_fecha_hasta => :fecha_hasta,
        p_id_box      => :id_box,
        p_pagina      => :pagina,
        p_tam_pagina  => :tam_pagina,
        p_todo_periodo => :todo_periodo);
END;
~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'cleancar.api', p_pattern => 'servicios-lavadero', p_method => 'GET',
      p_name => 'Authorization', p_bind_variable_name => 'authorization',
      p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');

  ORDS.DEFINE_HANDLER(
      p_module_name => 'cleancar.api', p_pattern => 'servicios-lavadero', p_method => 'POST',
      p_source_type => 'plsql/block',
      p_source      => q'~
DECLARE l_token VARCHAR2(256); l_pos PLS_INTEGER;
BEGIN
    OWA_UTIL.MIME_HEADER('application/json', FALSE);
    OWA_UTIL.HTTP_HEADER_CLOSE;
    l_token := :authorization;
    IF l_token IS NOT NULL THEN
        l_pos := INSTR(UPPER(l_token), 'BEARER ');
        IF l_pos > 0 THEN l_token := TRIM(SUBSTR(l_token, l_pos + 7)); END IF;
    END IF;
    PKG_SERVICIOS_CLEANCAR.INSERTAR(
        p_token       => l_token,
        p_id_box      => TO_NUMBER(:id_box),
        p_fecha       => :fecha,
        p_id_servicio => TO_NUMBER(:id_servicio),
        p_comentario  => :comentario,
        p_precio      => TO_NUMBER(:precio));
END;
~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'cleancar.api', p_pattern => 'servicios-lavadero', p_method => 'POST',
      p_name => 'Authorization', p_bind_variable_name => 'authorization',
      p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');

  ----------------------------------------------------------------------------
  -- /servicios-lavadero/:id
  ----------------------------------------------------------------------------
  BEGIN
    ORDS.DEFINE_TEMPLATE(p_module_name => 'cleancar.api', p_pattern => 'servicios-lavadero/:id',
        p_priority => 0, p_etag_type => 'HASH', p_comments => NULL);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  ORDS.DEFINE_HANDLER(
      p_module_name => 'cleancar.api', p_pattern => 'servicios-lavadero/:id', p_method => 'GET',
      p_source_type => 'plsql/block',
      p_source      => q'~
DECLARE l_token VARCHAR2(256); l_pos PLS_INTEGER;
BEGIN
    OWA_UTIL.MIME_HEADER('application/json', FALSE);
    OWA_UTIL.HTTP_HEADER_CLOSE;
    l_token := :authorization;
    IF l_token IS NOT NULL THEN
        l_pos := INSTR(UPPER(l_token), 'BEARER ');
        IF l_pos > 0 THEN l_token := TRIM(SUBSTR(l_token, l_pos + 7)); END IF;
    END IF;
    PKG_SERVICIOS_CLEANCAR.OBTENER(p_token => l_token, p_id => TO_NUMBER(:id));
END;
~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'cleancar.api', p_pattern => 'servicios-lavadero/:id', p_method => 'GET',
      p_name => 'Authorization', p_bind_variable_name => 'authorization',
      p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');

  ORDS.DEFINE_HANDLER(
      p_module_name => 'cleancar.api', p_pattern => 'servicios-lavadero/:id', p_method => 'PUT',
      p_source_type => 'plsql/block',
      p_source      => q'~
DECLARE l_token VARCHAR2(256); l_pos PLS_INTEGER;
BEGIN
    OWA_UTIL.MIME_HEADER('application/json', FALSE);
    OWA_UTIL.HTTP_HEADER_CLOSE;
    l_token := :authorization;
    IF l_token IS NOT NULL THEN
        l_pos := INSTR(UPPER(l_token), 'BEARER ');
        IF l_pos > 0 THEN l_token := TRIM(SUBSTR(l_token, l_pos + 7)); END IF;
    END IF;
    PKG_SERVICIOS_CLEANCAR.ACTUALIZAR(
        p_token       => l_token,
        p_id          => TO_NUMBER(:id),
        p_id_box      => TO_NUMBER(:id_box),
        p_fecha       => :fecha,
        p_id_servicio => TO_NUMBER(:id_servicio),
        p_comentario  => :comentario,
        p_precio      => TO_NUMBER(:precio));
END;
~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'cleancar.api', p_pattern => 'servicios-lavadero/:id', p_method => 'PUT',
      p_name => 'Authorization', p_bind_variable_name => 'authorization',
      p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');

  ORDS.DEFINE_HANDLER(
      p_module_name => 'cleancar.api', p_pattern => 'servicios-lavadero/:id', p_method => 'DELETE',
      p_source_type => 'plsql/block',
      p_source      => q'~
DECLARE l_token VARCHAR2(256); l_pos PLS_INTEGER;
BEGIN
    OWA_UTIL.MIME_HEADER('application/json', FALSE);
    OWA_UTIL.HTTP_HEADER_CLOSE;
    l_token := :authorization;
    IF l_token IS NOT NULL THEN
        l_pos := INSTR(UPPER(l_token), 'BEARER ');
        IF l_pos > 0 THEN l_token := TRIM(SUBSTR(l_token, l_pos + 7)); END IF;
    END IF;
    PKG_SERVICIOS_CLEANCAR.ELIMINAR(p_token => l_token, p_id => TO_NUMBER(:id));
END;
~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'cleancar.api', p_pattern => 'servicios-lavadero/:id', p_method => 'DELETE',
      p_name => 'Authorization', p_bind_variable_name => 'authorization',
      p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');

  COMMIT;
EXCEPTION
  WHEN OTHERS THEN
    ROLLBACK;
    RAISE;
END;
/

--------------------------------------------------------------------------------
-- === 3) CORS ===============================================================
--------------------------------------------------------------------------------
BEGIN
  ORDS.SET_MODULE_ORIGINS_ALLOWED(
    p_module_name     => 'cleancar.api',
    p_origins_allowed => 'https://josegalvez1985.github.io,http://localhost:8080,http://192.168.4.118:8080,http://172.30.144.1:8080'
  );
  COMMIT;
END;
/
