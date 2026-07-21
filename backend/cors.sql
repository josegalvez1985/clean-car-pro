--------------------------------------------------------------------------------
-- CORS del módulo cleancar.api — diagnóstico y reparación
--------------------------------------------------------------------------------
-- Para qué sirve: el 403 "failed cross origin request validation" significa que
-- el origen desde el que llama el navegador NO está en la lista blanca que tiene
-- la BASE. Tener el origen escrito en los .sql del repo no alcanza: hasta que no
-- se ejecuta SET_MODULE_ORIGINS_ALLOWED contra Oracle, la base sigue con el
-- valor viejo.
--
-- Este script es idempotente y se puede correr solo, sin reejecutar login.sql.
--
--   @backend/cors.sql
--------------------------------------------------------------------------------

SET SERVEROUTPUT ON

PROMPT ============================================================
PROMPT  1/2  Orígenes que tiene HOY la base
PROMPT ============================================================
-- Si esto imprime algo distinto de la lista de abajo (o no imprime nada), ese
-- es exactamente el motivo del 403.
DECLARE
  l_origins VARCHAR2(4000);
BEGIN
  SELECT origins_allowed INTO l_origins
    FROM user_ords_modules
   WHERE name = 'cleancar.api';

  IF l_origins IS NULL THEN
    DBMS_OUTPUT.PUT_LINE('origins_allowed esta VACIO -> ORDS rechaza todo origen.');
  ELSE
    DBMS_OUTPUT.PUT_LINE('origins_allowed actual: ' || l_origins);
  END IF;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    DBMS_OUTPUT.PUT_LINE('El modulo cleancar.api NO EXISTE. Ejecutar primero @backend/login.sql');
END;
/

PROMPT
PROMPT ============================================================
PROMPT  2/2  Aplicar la lista blanca
PROMPT ============================================================
BEGIN
  -- >>> CAMBIAR <<< : orígenes del frontend. Solo esquema+host+puerto, sin path
  -- y sin barra final. El origen de GitHub Pages es el dominio pelado
  -- (https://josegalvez1985.github.io), NO incluye /clean-car-pro/.
  --
  -- La IP 192.168.100.16 es para abrir la app desde el celular en la red local.
  -- Ojo: cambia por DHCP (ya pasó: antes era .86). Si deja de andar desde el
  -- telefono, mirá la IP nueva con `ipconfig`, actualizala acá y reejecutá.
  -- Para evitar el problema de raiz, reservá la IP por MAC en el router.
  ORDS.SET_MODULE_ORIGINS_ALLOWED(
    p_module_name     => 'cleancar.api',
    p_origins_allowed => 'https://josegalvez1985.github.io,http://localhost:8080,http://192.168.100.16:8080'
  );
  COMMIT;
END;
/

DECLARE
  l_origins VARCHAR2(4000);
BEGIN
  SELECT origins_allowed INTO l_origins
    FROM user_ords_modules
   WHERE name = 'cleancar.api';
  DBMS_OUTPUT.PUT_LINE('origins_allowed quedo en: ' || l_origins);
END;
/

PROMPT
PROMPT ============================================================
PROMPT  Extra: el modulo tiene definido auth/login?
PROMPT ============================================================
-- Si delete_module corrio y el script se corto antes de recrear los handlers,
-- el endpoint no existe y ORDS tampoco puede responder el preflight.
DECLARE
  l_n NUMBER;
BEGIN
  SELECT COUNT(*) INTO l_n
    FROM user_ords_templates t
    JOIN user_ords_modules m ON m.id = t.module_id
   WHERE m.name = 'cleancar.api';
  DBMS_OUTPUT.PUT_LINE('Templates definidos en cleancar.api: ' || l_n);
  IF l_n = 0 THEN
    DBMS_OUTPUT.PUT_LINE('!! No hay endpoints. Reejecutar @backend/login.sql y los demas scripts.');
  END IF;
END;
/

PROMPT
PROMPT  Listo. Verificar el PREFLIGHT DEL LOGIN desde una terminal. Es un POST
PROMPT  con Content-Type: application/json, asi que el navegador manda OPTIONS
PROMPT  antes. Debe responder 200 y traer Access-Control-Allow-Origin:
PROMPT
PROMPT    curl -i -X OPTIONS https://oracleapex.com/ords/wksp_evamar/api/auth/login \
PROMPT      -H "Origin: https://josegalvez1985.github.io" \
PROMPT      -H "Access-Control-Request-Method: POST" \
PROMPT      -H "Access-Control-Request-Headers: content-type"
PROMPT
PROMPT  Y despues el login real (debe dar 200 con {"token":...} o 401):
PROMPT
PROMPT    curl -i -X POST https://oracleapex.com/ords/wksp_evamar/api/auth/login \
PROMPT      -H "Origin: https://josegalvez1985.github.io" \
PROMPT      -H "Content-Type: application/json" \
PROMPT      -d '{"username":"JOSEG","password":"tu-clave"}'
PROMPT
