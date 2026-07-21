# Guía: desplegar Clean Car (GitHub Pages y host con Node)

Adaptada al estado real de este repo. Varias cosas que suelen faltar **ya están
hechas acá** — la tabla de §1 dice cuáles, para no "arreglar" lo que funciona.

> **El punto que decide todo:** Clean Car habla con Oracle ORDS, que valida el
> origen. En dev eso no se nota porque Vite proxea; en un sitio estático sí.
> Por eso §5 (CORS) es la sección que importa, no el `base`.

---

## 1. Qué ya está resuelto en este repo

| Punto                                 | Estado                                      | Dónde                                                        |
| ------------------------------------- | ------------------------------------------- | ------------------------------------------------------------ |
| `base` condicional                    | ✅ vía `VITE_BASE_PATH` (no `GITHUB_PAGES`) | [vite.config.ts](vite.config.ts)                             |
| `basepath` del router                 | ✅ `import.meta.env.BASE_URL`               | [src/router.tsx](src/router.tsx)                             |
| `404.html` para rutas SPA             | ✅                                          | [.github/workflows/deploy.yml](.github/workflows/deploy.yml) |
| `.nojekyll`                           | ✅                                          | idem                                                         |
| `cancel-in-progress: false`           | ✅                                          | idem                                                         |
| Assets sin rutas absolutas            | ✅ sin ocurrencias                          | —                                                            |
| Orígenes CORS en los `.sql`           | ✅ escritos                                 | [backend/cors.sql](backend/cors.sql)                         |
| Orígenes CORS **aplicados en Oracle** | ⚠️ hay que ejecutarlos                      | ver §5                                                       |

---

## 2. El `base` (causa nº1 de la pantalla en blanco)

En local la app vive en `/`; en Pages vive en `/clean-car-pro/`. Si el bundle
pide `/assets/app.js`, en Pages eso es un 404 y la pantalla queda en blanco.

Acá se resuelve con `VITE_BASE_PATH`, que el workflow inyecta con el nombre del
repo. La barra final es obligatoria. En el código, nunca hardcodear `/logo.png`:
usar `import.meta.env.BASE_URL` o importar el asset y que Vite reescriba la URL.

> Excepción: si el repo se llamara `<usuario>.github.io`, el sitio se sirve en la
> raíz y `base` debe quedar en `/` siempre.

---

## 3. Rutas SPA y Jekyll

Pages no tiene rewrites: entrar directo a `/clean-car-pro/ventas` o recargar esa
URL da 404. Por eso el workflow copia `index.html` a `404.html` — Pages lo sirve
ante cualquier ruta desconocida y el router del cliente toma el control.

`.nojekyll` es igual de obligatorio: sin él, Jekyll descarta todo lo que empieza
con `_` (y Vite genera esos nombres). La app queda rota **sin error visible**.

---

## 4. Probar Pages en local antes de pushear

Detecta la mayoría de los problemas de `base`:

```bash
npm run preview:pages
```

Abrí `http://localhost:4173/clean-car-pro/` y navegá. Si carga ahí, carga en Pages.

> Ojo: este preview reproduce el `base`, **no** el CORS. El preview local sale
> desde `localhost`, que sí está en la lista blanca; Pages sale desde
> `github.io`. Que ande el preview no prueba que ande el deploy.

---

## 5. CORS — el error real de este proyecto

Síntoma: **403 `failed cross origin request validation`**.

Significa que el origen desde el que llama el navegador no está en la lista
blanca **que tiene la base**. El detalle que cuesta caro:

> Tener el origen escrito en los `.sql` del repo **no hace nada**.
> `SET_MODULE_ORIGINS_ALLOWED` solo surte efecto al ejecutarse contra Oracle.

Diagnóstico y reparación en un solo script (imprime lo que tiene hoy la base,
después aplica la lista):

```sql
@backend/cors.sql
```

Verificación desde una terminal — debe dar 200 y traer `Access-Control-Allow-Origin`:

```bash
curl -i -X OPTIONS https://oracleapex.com/ords/wksp_evamar/api/boxes \
  -H "Origin: https://josegalvez1985.github.io" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization"
```

### Por qué falla primero el login

`delete_module` **borra los orígenes CORS del módulo**, y
[backend/login.sql](backend/login.sql) lo llama antes de recrearlo. Si ese script
se corta antes del paso 4/5 —o si se ejecuta después de `boxes.sql` /
`servicios.sql`, que reaplican el CORS al final— el módulo queda **sin lista
blanca** y todo responde 403.

Se nota primero en el login porque es un `POST` con
`Content-Type: application/json`: eso dispara **preflight**, y el `OPTIONS` muere
antes de que salga el POST. Un `GET` simple no dispara preflight, así que puede
parecer que "solo el login está roto".

Ya está mitigado: `define_module` ahora recibe `p_origins_allowed` en la misma
llamada que crea el módulo, así nunca existe sin CORS.

> No agregar handlers `OPTIONS` a mano. Con `origins_allowed` cargado ORDS
> responde el preflight solo; un handler propio duplica los headers
> (ver [GUIA-CRUD.md §1.3](GUIA-CRUD.md)).

### Otras dos trampas

Documentadas en [backend/GUIA.md](backend/GUIA.md#L204):

- El origen es el **dominio pelado** (`https://josegalvez1985.github.io`), sin
  `/clean-car-pro/` y sin barra final.
- Con lista blanca activa, la validación corre sobre **toda** request al módulo:
  el 403 aparece también en curl sin header `Origin`. No es un bug del navegador.

La lista es: Pages + `localhost:8080` + `192.168.100.86:8080` (el celular en la
red local). **Esa IP cambia por DHCP** — si la app deja de andar desde el
teléfono, mirá la IP nueva con `ipconfig`, actualizala en
[backend/cors.sql](backend/cors.sql) y reejecutá.

---

## 6. La alternativa sin CORS: host con Node

Un host con servidor reproduce el proxy de dev, así que ORDS ve un request
same-origin y el CORS deja de importar. [vercel.json](vercel.json) ya tiene el
rewrite de `/api/*` hacia ORDS más el fallback SPA.

Para ese deploy el bundle tiene que apuntar a `/api` (no a la URL absoluta):

```
VITE_API_URL=/api
VITE_BASE_PATH=/
```

Cuándo conviene: si no tenés acceso a la base para correr `cors.sql`, si querés
entrar desde el celular sin ir agregando IPs a mano cada vez que cambian, o si
más adelante querés esconder el token del cliente —eso último **solo** es
posible con servidor.

---

## 7. Variables de entorno

Solo se inyectan al bundle las que empiezan con `VITE_`, y **quedan visibles en
el JavaScript público**. Nunca un secreto ahí.

En el workflow, `VITE_API_URL` sale de `vars.VITE_API_URL` (Settings → Secrets
and variables → Actions → Variables). Si esa variable no está definida queda
vacía y entra el fallback `DEFAULT_API_URL` de [vite.config.ts](vite.config.ts):
el build no falla, simplemente usa la URL por defecto. Conviene definirla para
que el valor sea explícito.

---

## 8. Checklist

- [ ] `@backend/cors.sql` ejecutado en Oracle (§5) ← **el que destraba el 403**
- [ ] Settings → Pages → Source = **GitHub Actions** (sin esto el workflow corre verde pero no publica)
- [ ] `vars.VITE_API_URL` definida en el repo
- [ ] Probado con `npm run preview:pages`
- [ ] Verificado el preflight con `curl` (§5)

---

## 9. Síntomas → causa

| Síntoma                                                | Causa probable                                                                                       |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| 403 `failed cross origin request validation`           | `cors.sql` no ejecutado en la base, u origen mal escrito                                             |
| Anda en local pero no en Pages                         | El proxy de Vite no existe en el sitio publicado (§5/§6)                                             |
| Falla el login pero otras pantallas cargan             | El POST del login dispara preflight; el módulo quedó sin `origins_allowed` tras `delete_module` (§5) |
| Anda en la compu pero no en el celular (por IP de LAN) | Esa IP no está en `origins_allowed`; agregarla en `cors.sql` (§5)                                    |
| Pantalla en blanco, 404 de `/assets/*.js`              | `base` mal o ausente                                                                                 |
| Home anda, 404 al recargar una subruta                 | Falta `404.html` o el `basepath` del router                                                          |
| Faltan archivos que empiezan con `_`                   | Falta `.nojekyll`                                                                                    |
| El deploy queda "queued" para siempre                  | Deploy previo cancelado; `cancel-in-progress: false`                                                 |
| Workflow verde pero el sitio no cambia                 | Source no está en "GitHub Actions"                                                                   |
| Se publica una versión vieja                           | Caché del navegador o del Service Worker ([public/sw.js](public/sw.js)); probar en incógnito         |
