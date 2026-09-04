# Prompt para Claude Code

Copiá esto y pegáselo a Claude Code (o a la herramienta que uses) con la carpeta `oggi-app` abierta.

---

Este es OGGI, un organizador personal. Es una app web sin paso de compilación:
HTML + módulos ES nativos + Supabase cargado desde CDN. No hay npm, ni bundler, ni framework.
Mantené ese enfoque salvo que te pida lo contrario.

**Estructura**
- `index.html` — estilos (variables CSS al inicio) y tres contenedores: `#cargando`, `#acceso`, `#app`.
- `js/config.js` — URL y anon key de Supabase.
- `js/db.js` — única capa que habla con Supabase (auth + CRUD genérico + guardado con retardo).
- `js/app.js` — todo el estado y las vistas. `estado.datos` son las filas; `estado.ui` es la interfaz.
  Cada cambio llama a `render()`, que reconstruye `#app` con plantillas de texto.
  Los eventos van por delegación en `document`, leyendo atributos `data-*`.
- `esquema.sql` — Postgres + políticas RLS (`user_id = auth.uid()` en cada tabla).

**Reglas al modificar**
1. No cambies el diseño visual: colores, tipografías, medidas y radios están decididos y validados.
   La paleta pastel es un arreglo de 6 colores y las filas guardan un índice `color` (0-5), no un hex.
2. Toda escritura pasa por `db.js`. Nada de `fetch` suelto ni de `supabase` fuera de ese archivo.
3. Actualizá primero `estado.datos` y llamá `render()`, después mandá el cambio al servidor
   (guardado optimista). Los errores se muestran con `aviso()`.
4. El texto libre (notas, descripciones) se guarda con `db.guardarConRetardo` para no escribir en cada tecla.
5. Si agregás una tabla: creala en `esquema.sql` **con su política RLS**, sumala a `db.TABLAS`,
   y recién ahí usala en `app.js`.

**Estado actual**

Las cinco tareas que estaban pendientes ya están resueltas:

1. **Borrado de cuenta.** Edge Function `supabase/functions/borrar-cuenta/index.ts` con
   `service_role` que llama a `auth.admin.deleteUser` (el `on delete cascade` del esquema limpia
   el resto). `db.borrarCuenta()` la invoca; el botón "Eliminar mi cuenta" del menú ⚙ pide doble
   confirmación. Hay que desplegarla con `supabase functions deploy borrar-cuenta` (ver
   INSTRUCCIONES.md, Paso 4) — sin eso el botón muestra un error al usarse.
2. **Modo noche**: interruptor ☾/☀ en la cabecera, bloque `[data-tema="noche"]` en `index.html`
   y preferencia en `localStorage` (`oggi-tema`).
3. **Campana de recordatorios**: función `recordatorios()` en `app.js`, ícono 🔔 con contador.
4. **Importar respaldo**: `db.importarTodo()` + input de archivo oculto (`#importFile`), con opción
   de agregar o reemplazar.
5. **Aviso de sin conexión**: `db.js` envuelve `crear/actualizar/borrar/guardarPerfil` con
   `conReintento()`; si falla por red, encola el cambio y lo reintenta solo al evento `online`.
   `db.alCambiarConexion(fn)` avisa a `app.js`, que muestra un ícono 📡 en la cabecera.

**Próximas tareas posibles** (no hay nada urgente pedido todavía; preguntá antes de asumir prioridad)

- Notificaciones del sistema para los recordatorios (hoy solo viven dentro de la app).
- Backups automáticos programados, además del botón manual ⤓.

**Cómo probar**
Levantá un servidor local (`npx serve oggi-app`) — abrir el archivo directamente no funciona por
las restricciones de módulos ES. Necesitás un proyecto de Supabase con el `esquema.sql` ya corrido
y los datos en `js/config.js`.
