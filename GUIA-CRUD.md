# Guía: migrar una página de APEX a Clean Car

Receta para pasar una pantalla del sistema APEX a esta PWA **en una sola pasada**,
sin ir y volver pidiendo datos. Backend primero, cliente después, UI al final.

> **Alcance de la entrega:** escribir el backend (`.sql`) y el frontend, y validar
> con `tsc` + `eslint`. **Sin pruebas en navegador ni scripts de Playwright** —
> consumen demasiados tokens. Ver §4.

---

## 0. Qué pedir ANTES de escribir una línea

Para cada página nueva hacen falta **tres cosas**. Si falta alguna, pedirla y esperar:

1. **El DDL de la tabla** (`CREATE TABLE`), con sus FK.
2. **El DDL de las tablas referenciadas** por esas FK (las que llenan los selectores).
3. **El export de la página APEX** (`f<app>_page_<n>.sql`).

> El export es el que más información aporta y el que más fácil se olvida. De ahí
> salen: los nombres de los LOV, las acciones dinámicas (autocompletados), las
> etiquetas visibles, los campos obligatorios y los botones extra. Sin él se
> termina inventando campos que no existen.

**Qué leer del export** (buscar estas claves):

| Clave en el export | Qué revela |
| --- | --- |
| `p_named_lov=>'TABLA.COLUMNA'` | Qué tabla y columna llena cada selector |
| `p_prompt=>'...'` | La etiqueta visible (¡no inventar!) |
| `p_is_required=>true` | Campos obligatorios |
| `p_cMaxlength` | Largo máximo del campo |
| `create_page_da_action` + `plsql_function_body` | Autocompletados y cálculos |
| `p_display_as` | Tipo de control (textarea, select, date picker…) |
| `create_page_button` | Botones extra (imprimir, duplicar…) |

Ejemplo real: en la página 14, el bloque
`select precio into vPrecio from SERVICIOS_LAV where id_servicio = ...` reveló
que el precio se autocompleta al elegir el servicio. Eso no está en el DDL.

---

## 1. Backend: paquete PL/SQL + endpoints ORDS

Un archivo por tabla en `backend/<tabla>.sql`, con dos secciones: el paquete y
los endpoints. **La lógica va en el paquete**, nunca dentro del handler.

### 1.1 Estructura del paquete

```sql
CREATE OR REPLACE PACKAGE PKG_<ENTIDAD>_CLEANCAR AS
  PROCEDURE LISTAR(p_token IN VARCHAR2);
  PROCEDURE OBTENER(p_token IN VARCHAR2, p_id IN NUMBER);
  PROCEDURE INSERTAR(p_token IN VARCHAR2, /* columnas */);
  PROCEDURE ACTUALIZAR(p_token IN VARCHAR2, p_id IN NUMBER, /* columnas */);
  PROCEDURE ELIMINAR(p_token IN VARCHAR2, p_id IN NUMBER);
END;
/
```

Dos helpers al inicio del body, iguales en todos los paquetes:

```sql
PROCEDURE p_error(p_status IN NUMBER, p_reason IN VARCHAR2, p_message IN VARCHAR2) IS
BEGIN
  OWA_UTIL.STATUS_LINE(p_status, p_reason, FALSE);
  APEX_JSON.OPEN_OBJECT;
  APEX_JSON.WRITE('success', FALSE);
  APEX_JSON.WRITE('message', p_message);
  APEX_JSON.CLOSE_OBJECT;
END;

FUNCTION f_usuario(p_token IN VARCHAR2) RETURN VARCHAR2 IS
BEGIN
  RETURN CC_AUTH.VALIDAR_TOKEN(p_token);   -- devuelve el usuario o NULL
END;
```

### 1.2 Reglas obligatorias

1. **TODO procedimiento valida el token primero** — incluidos `LISTAR` y
   `OBTENER`. Sin excepción:

   ```sql
   l_usuario := f_usuario(p_token);
   IF l_usuario IS NULL THEN
     p_error(401, 'Unauthorized', 'Token invalido o expirado');
     RETURN;
   END IF;
   ```

2. **Las columnas se enumeran explícitamente.** Nunca `SELECT *` hacia el JSON:
   el front depende de nombres estables.

3. **El JSON se arma con `APEX_JSON`**, con este contrato fijo:

   | Caso | HTTP | Cuerpo |
   | --- | --- | --- |
   | Lista | 200 | `{"success":true,"data":[ {...}, {...} ]}` |
   | Detalle | 200 | `{"success":true,"data":{...}}` |
   | Alta | 201 | `{"success":true,"message":"...","id_x":123}` |
   | Modificación / baja | 200 | `{"success":true,"message":"..."}` |
   | Sin token | 401 | `{"success":false,"message":"..."}` |
   | Sin permiso (rol) | 403 | `{"success":false,"message":"..."}` |
   | Validación | 400 | `{"success":false,"message":"..."}` |
   | No existe | 404 | `{"success":false,"message":"..."}` |
   | FK que bloquea | 409 | `{"success":false,"message":"..."}` |

   > No usar `DBMS_XMLGEN.getJSON`: devuelve `{"ROWSET":{"ROW":...}}` y cambia
   > de forma cuando hay una sola fila, lo que obliga a adivinar en el cliente.

4. **PK por IDENTITY**: no se pasa en el `INSERT`, se recupera con
   `RETURNING <pk> INTO l_id`.

5. **Fechas como texto `YYYY-MM-DD`** en ambos sentidos: `TO_DATE(p_fecha,
   'YYYY-MM-DD')` al entrar, `TO_CHAR(r.fecha, 'YYYY-MM-DD')` al salir.

6. **Errores de FK traducidos a mensaje entendible**:

   ```sql
   IF SQLCODE = -2292 THEN   -- hijos existentes: no se puede borrar
     p_error(409, 'Conflict', 'No se puede eliminar: tiene servicios asociados');
   ELSIF SQLCODE = -2291 THEN -- padre inexistente: id inválido
     p_error(400, 'Bad Request', 'El box o el servicio no existe');
   ```

7. **`COMMIT` al final del camino feliz; `ROLLBACK` en el handler de excepción.**
   También `ROLLBACK` antes de un 404 por `SQL%ROWCOUNT = 0`.

8. **`ACTUALIZAR` y `ELIMINAR` verifican el rol después del token, nunca antes**
   (primero 401 si no hay sesión, después 403 si la sesión no alcanza). La
   lista de usuarios habilitados vive en un solo lugar,
   `CC_AUTH.ES_ADMIN` ([backend/login.sql](backend/login.sql)) — nunca se
   repite `IN ('JOSEG', 'EVAC')` en cada paquete:

   ```sql
   l_usuario := f_usuario(p_token);
   IF l_usuario IS NULL THEN
     p_error(401, 'Unauthorized', 'Token invalido o expirado');
     RETURN;
   END IF;
   IF NOT CC_AUTH.ES_ADMIN(l_usuario) THEN
     p_error(403, 'Forbidden', 'No tenes permiso para modificar registros');
     RETURN;
   END IF;
   ```

   `LISTAR`, `OBTENER` e `INSERTAR` (el alta) **no** llevan este chequeo —
   cualquier usuario logueado puede crear y consultar; solo editar/eliminar
   está restringido. En el cliente, `esAdmin(user)` de
   [src/lib/auth.tsx](src/lib/auth.tsx) oculta los botones de lápiz/basurero
   para quien no tiene permiso — es solo UX, la autorización real es el 403
   del backend.

8. **`LISTAR` de una tabla que crece sin límite (movimientos, ventas, logs)
   nunca trae todo de una.** Paginar con `OFFSET ... FETCH NEXT` y devolver
   `total` junto a `data`, así el cliente sabe si hay más:

   ```sql
   PROCEDURE LISTAR(
       p_token IN VARCHAR2, p_fecha_desde IN VARCHAR2 DEFAULT NULL,
       p_fecha_hasta IN VARCHAR2 DEFAULT NULL, p_pagina IN VARCHAR2 DEFAULT NULL,
       p_tam_pagina IN VARCHAR2 DEFAULT NULL, p_todo_periodo IN VARCHAR2 DEFAULT NULL);
   ```

   - **Filtro de fecha por defecto = mes en curso** si el caller no pasa
     `fecha_desde`/`fecha_hasta`. Evita el caso típico de una pantalla de
     "Consulta"/"Ventas" que sin querer trae años de historial la primera vez
     que se abre.
   - **`p_todo_periodo='S'` lo desactiva** para los pocos casos que sí quieren
     los N registros más recientes sin importar el mes (p.ej. "Últimos
     movimientos" de una home, que con el filtro de mes mostraría de menos si
     el mes recién empezó).
   - `p_pagina` arranca en 1; `p_tam_pagina` con default razonable (30) y tope
     (200) para que un valor absurdo del cliente no golpee la base.
   - El `SELECT COUNT(*)` del total usa el mismo `WHERE` que el cursor de la
     página — repetir el filtro, no factorizarlo en una vista: son dos
     sentencias independientes y es más fácil ver que están sincronizadas.
   - En el cliente, el botón **"Mostrar más"** pide la página siguiente y
     concatena (`setFilas(prev => [...prev, ...nuevas])`); no reemplaza la
     lista. Ver [src/routes/ventas.tsx](src/routes/ventas.tsx).

### 1.3 Endpoints ORDS

Rutas REST, colgadas del módulo **`cleancar.api`** (así heredan el CORS que ya
configuró `login.sql`):

```
GET    /api/<entidad>       -> LISTAR
GET    /api/<entidad>/:id   -> OBTENER
POST   /api/<entidad>       -> INSERTAR
PUT    /api/<entidad>/:id   -> ACTUALIZAR
DELETE /api/<entidad>/:id   -> ELIMINAR
```

Cada handler es un envoltorio fino que extrae el Bearer y delega:

```sql
ORDS.DEFINE_HANDLER(
    p_module_name => 'cleancar.api', p_pattern => '<entidad>', p_method => 'GET',
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
    PKG_<ENTIDAD>_CLEANCAR.LISTAR(p_token => l_token);
END;
~');

-- SIN ESTO EL TOKEN NO LLEGA: ORDS no pasa el header por defecto.
ORDS.DEFINE_PARAMETER(
    p_module_name => 'cleancar.api', p_pattern => '<entidad>', p_method => 'GET',
    p_name => 'Authorization', p_bind_variable_name => 'authorization',
    p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
```

Detalles que evitan errores:

- **`DEFINE_PARAMETER` de `Authorization` en CADA método.** Es el olvido más
  común y produce 401 con un token válido.
- Los campos del body JSON llegan como binds automáticos (`:descripcion`,
  `:precio`). Los numéricos requieren `TO_NUMBER(:campo)`.
- Empezar el bloque con `ORDS.DELETE_HANDLER(...)` envuelto en
  `EXCEPTION WHEN OTHERS THEN NULL` para que el script sea reejecutable.
- `DEFINE_TEMPLATE` también entre `BEGIN/EXCEPTION` por si ya existe.
- **No** escribir headers CORS a mano con `HTP.P`: los duplica con los que ya
  emite `SET_MODULE_ORIGINS_ALLOWED`. El CORS se maneja solo a nivel de módulo.

### 1.4 Ejecutar y probar antes de tocar el front

```bash
@backend/<tabla>.sql
```

```bash
# Debe dar 401 (sin token)
curl -i https://<host>/ords/<schema>/api/<entidad>

# Debe dar 200 con {"success":true,"data":[...]}
curl -i https://<host>/ords/<schema>/api/<entidad> -H "Authorization: Bearer <token>"
```

> **Este paso no se saltea.** Escribir el cliente contra endpoints que no existen
> produce errores de CORS confusos: el navegador dice "falta
> Access-Control-Allow-Origin" cuando el problema real es que la ruta no existe y
> ORDS no puede responder el preflight.

---

## 2. Cliente: un archivo por dominio en `src/lib/`

Como el contrato es fijo, el cliente es trivial:

```ts
interface Envelope<T> {
  success?: boolean;
  data?: T;
  message?: string;
}

function lista<T>(r: Envelope<T[]>): T[] {
  return r.data ?? [];
}

export interface Box {
  id_box: number;
  descripcion: string;
}

export async function listarBoxes(): Promise<Box[]> {
  return lista(await request<Envelope<Box[]>>("/boxes"));
}

export async function crearBox(descripcion: string) {
  return request<Envelope<never>>("/boxes", {
    method: "POST",
    body: JSON.stringify({ descripcion }),
  });
}
```

Reglas:

- **Los tipos usan los nombres de columna tal cual** (`id_box`, no `idBox`). Evita
  una capa de traducción y hace obvio a qué columna corresponde cada campo.
- **Nunca llamar `fetch` directo**: usar `request()` de [src/lib/api.ts](src/lib/api.ts),
  que ya agrega el `Authorization: Bearer`, parsea el error y cierra la sesión ante 401/403.
- **No escribir código defensivo que adivine formatos.** Si el backend cumple el
  contrato, no hace falta.
- **`LISTAR` paginado** (ver §1.2.8) devuelve `{ data, total }` en vez de
  `T[]` a secas — el `total` es lo que le permite al cliente decidir si
  mostrar "Mostrar más". Los filtros van en un objeto con nombres en
  camelCase (`fechaDesde`, `idBox`) que la función traduce a query params
  `snake_case` (`fecha_desde`, `id_box`); ver
  `listarServiciosLavadero` en [src/lib/servicios.ts](src/lib/servicios.ts).

---

## 3. UI: página o drawer

**Cuándo cada uno:**

- Página completa (`src/routes/<x>.tsx`) para listados y ABM.
- Drawer sobre la home para el alta frecuente (el equivalente a un modal de APEX).

**Estructura de una página de listado** (ver [src/routes/boxes.tsx](src/routes/boxes.tsx)):

```
header sticky: volver + título + contador + botón Nuevo
main: cargando | error+reintentar | vacío | lista con buscador y encabezados ordenables
Drawer: formulario de alta/edición
AlertDialog: confirmación de borrado
```

Los cuatro estados —cargando, error, vacío, con datos— **se implementan siempre**.
El estado de error necesita botón "Reintentar"; el vacío, una acción para crear
el primer registro.

**Toda lista con datos lleva buscador global + columnas ordenables.** Ya existe
la infraestructura, no se reimplementa por pantalla:

```tsx
import { useTabla, type Columna } from "@/lib/use-tabla";
import { BuscadorTabla, EncabezadosTabla } from "@/components/tabla-toolbar";

const COLUMNAS: Columna<Box>[] = [{ campo: "descripcion", titulo: "Descripción" }];
// numérica: true en las columnas de importe/cantidad, para alinearlas a la derecha

const { busqueda, setBusqueda, campo, direccion, ordenarPor, resultado } = useTabla(
  boxes,
  "descripcion", // campo de orden inicial
);
```

- `BuscadorTabla` va **antes** del contenedor de la tarjeta; `EncabezadosTabla`
  va **dentro**, como primera fila. Se itera `resultado` en el `.map`, nunca el
  array original — si no, el buscador y el orden no tienen efecto visible.
- La búsqueda es global (no por columna): concatena todos los campos de la fila,
  así "lavado 85000" encuentra por descripción y precio a la vez. No pedir al
  usuario que elija en qué columna buscar.
- El tipo de la fila (`Box`, `Servicio`, …) no necesita index signature: alcanza
  con que sea un `object` con las columnas ya definidas en `src/lib/servicios.ts`.

**Convenciones visuales** (coherencia con el resto):

- Fondo: `<AquaBackground subtle />` dentro de un contenedor `relative`.
- Tarjetas: `rounded-2xl border border-border/60 bg-card/70 backdrop-blur`.
- Importes y fechas: `tabular-nums`.
- Estados: tokens `success` / `warning` (definidos en `styles.css`), **nunca** el
  color primario, que se reserva para lo accionable.
- Si la pantalla tiene barra inferior fija, el `<main>` reserva su alto:
  `pb-[calc(5.5rem+env(safe-area-inset-bottom))]`.
- Etiquetas: las del export de APEX (`p_prompt`), no inventadas.

**Después de guardar o borrar**: `toast` + recargar la lista. Los mensajes de
error salen del backend (`message`), no se escriben genéricos en el front.

**Todo campo de precio/monto usa `InputMonto`**
([src/components/ui/input-monto.tsx](src/components/ui/input-monto.tsx)), nunca
`<Input type="number">`. Formatea con separador de miles **mientras se
escribe** (`85.000`), no solo al mostrar en una lista:

```tsx
import { InputMonto } from "@/components/ui/input-monto";

<InputMonto id="precio" value={precio} onChange={setPrecio} placeholder="0" required />
```

- `value`/`onChange` manejan un string de solo dígitos (`"85000"`), igual que
  un `<input type="number">`; el componente se encarga de mostrar el
  separador y de limpiarlo al leer lo que tipea el usuario.
- No aplica a porcentajes (comisión, etc.) — esos siguen con `type="number"`.
- **Si el precio viene de un catálogo y no debe poder alterarse** (p.ej. el
  precio de lista al cargar un servicio en
  [src/components/registrar-lavado.tsx](src/components/registrar-lavado.tsx)),
  el input queda `disabled` y se autocompleta al elegir el ítem del catálogo.
  Usar `className="disabled:opacity-100"` para que no se vea apagado — sigue
  siendo el dato principal de la pantalla, solo no editable.

**Los campos de texto libre (observación, comentario) son opcionales por
defecto**, salvo que el negocio pida lo contrario explícitamente — no agregar
`required` "porque la columna es NOT NULL". Si la columna real es NOT NULL:

- El **backend** decide el valor por defecto cuando llega vacío/null (p.ej.
  `PKG_SERVICIOS_CLEANCAR.INSERTAR/ACTUALIZAR` en
  [backend/servicios.sql](backend/servicios.sql) usa la descripción del
  servicio si no hay observación) — nunca lo inventa el front ni se relaja el
  `NOT NULL` de la tabla sin que lo pida el usuario.
- El **front** no valida "campo obligatorio" para ese campo, y el placeholder
  aclara qué pasa si se deja vacío (`"...si lo dejás vacío, se usa el nombre
  del servicio"`).
- Ojo con Oracle: un `VARCHAR2` vacío (`''`) se trata como `NULL`, así que
  "opcional" y "el backend rellena si es null" son la misma rama de código.

---

## 4. Validar

Solo estas tres verificaciones, que son baratas:

```bash
npx tsc --noEmit                 # tipos
npx prettier --write <archivos>  # formato
npx eslint <archivos>            # lint
```

> **NO abrir el navegador ni escribir scripts de Playwright.** Levantar el dev
> server, simular la API e inspeccionar capturas consume muchísimos tokens. La
> entrega es **backend + frontend escritos y compilando**; las pruebas las hace
> el usuario ejecutando los scripts SQL y abriendo la app.
>
> Excepción: solo si el usuario reporta un bug que no se puede diagnosticar
> leyendo el código, y lo pide explícitamente.

---

## 5. Errores ya cometidos — no repetirlos

| Error | Consecuencia | Cómo evitarlo |
| --- | --- | --- |
| Escribir el cliente antes que el backend | CORS confuso; rutas inventadas | Backend primero, probado con `curl` |
| Inventar campos que no están en la tabla | Datos que no se guardan | Solo columnas del DDL |
| Ignorar el export de APEX | Falta el autocompletado de precio, etiquetas mal | Leerlo antes de empezar |
| `DBMS_XMLGEN.getJSON` | Formato variable; cliente lleno de parches | `APEX_JSON` con `{success,data}` |
| Olvidar `DEFINE_PARAMETER` de `Authorization` | 401 con token válido | Uno por método, siempre |
| Validar el token solo en escritura | Listados abiertos sin sesión | Los cinco procedimientos validan |
| Suponer que el CORS está mal | Se pierde tiempo en el lugar equivocado | Revisar primero si la ruta existe |
| Levantar el navegador a probar | Gasto enorme de tokens por poco valor | Entregar código que compila; probar lo hace el usuario |

---

## 6. Estado actual

| Página APEX | Tabla | Backend | Front |
| --- | --- | --- | --- |
| — (login) | `CC_TOKENS` | [backend/login.sql](backend/login.sql) | [src/routes/index.tsx](src/routes/index.tsx) |
| 1 (home) | `SERVICIOS_LAVADERO` ("Últimos movimientos", Facturado/Lavados/Variación de hoy vs. ayer) | [backend/servicios.sql](backend/servicios.sql) | [src/routes/home.tsx](src/routes/home.tsx) · ocupación de boxes (`RESUMEN.boxes`) sigue con datos de ejemplo — no hay concepto de "lavado en curso" en el modelo |
| 8 (Box) | `BOX_LAV` | [backend/boxes.sql](backend/boxes.sql) | [src/routes/boxes.tsx](src/routes/boxes.tsx) |
| 14 (Servicios Lavadero) | `SERVICIOS_LAVADERO` | [backend/servicios.sql](backend/servicios.sql) | [src/components/registrar-lavado.tsx](src/components/registrar-lavado.tsx) + [src/components/ticket-lavado.tsx](src/components/ticket-lavado.tsx) (ticket 57mm, `window.print()`) |
| 6 y 7 (Servicios) | `SERVICIOS_LAV` | [backend/catalogo-servicios.sql](backend/catalogo-servicios.sql) | [src/routes/servicios.tsx](src/routes/servicios.tsx) |
| 15 y 16 (Ventas / Ver Ventas) | `SERVICIOS_LAVADERO` | [backend/servicios.sql](backend/servicios.sql) | [src/routes/ventas.tsx](src/routes/ventas.tsx) |

**Pendiente de ejecutar en la base**, en este orden:

```sql
@backend/login.sql
@backend/boxes.sql
@backend/servicios.sql
@backend/catalogo-servicios.sql
```

**Pendiente de decidir**:

- **Auditoría.** `f_usuario()` ya devuelve quién hace la operación, pero las
  tablas no tienen columna para guardarlo.

**Permisos por rol — resuelto.** Solo `JOSEG` y `EVAC` pueden editar/eliminar
(`CC_AUTH.ES_ADMIN` en [backend/login.sql](backend/login.sql), aplicado en
`ACTUALIZAR`/`ELIMINAR` de los tres paquetes CRUD). El alta sigue abierta a
cualquier usuario con sesión. Ver regla §1.2.8.

**Ticket de impresión — resuelto.** APEX genera un PDF de 57mm con pdfmake
(página 14); en la PWA se optó por impresión nativa del navegador en vez de
sumar una librería de PDF:

- [src/components/ticket-lavado.tsx](src/components/ticket-lavado.tsx)
  renderiza el ticket en HTML, oculto en pantalla (`.ticket-imprimir` en
  [src/styles.css](src/styles.css) con `display:none`, visible solo dentro de
  `@media print`, que además oculta el resto de la página con
  `body * { visibility: hidden }`).
- Tras un alta exitosa, [src/components/registrar-lavado.tsx](src/components/registrar-lavado.tsx)
  no cierra el drawer: muestra una confirmación con los botones **Imprimir**
  (`window.print()`) y **Listo** (recién ahí llama a `onDone`). Mismo patrón
  que la página 14 de APEX, que habilita "Imprimir" después de guardar.
- **No se replicó en la edición de ventas** ([src/routes/ventas.tsx](src/routes/ventas.tsx),
  equivalente a la página 16): se decidió que el ticket se imprime una sola
  vez, al momento del alta.
- Para replicar este patrón de impresión en otra pantalla: agregar la clase
  `ticket-imprimir` (o una nueva `@media print` con otro nombre de clase si el
  layout difiere) y llamar `window.print()` desde un botón — no hace falta
  ninguna librería nueva.
