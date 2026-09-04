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

**Tareas pendientes, en orden de prioridad**

1. **Borrado de cuenta.** Necesario para abrir al público. Requiere una Edge Function de Supabase
   con `service_role` que llame a `auth.admin.deleteUser`; el `on delete cascade` del esquema
   limpia el resto. Agregá la confirmación en la interfaz.
2. **Modo noche** con interruptor sol/luna en la cabecera. Todos los colores ya son variables CSS
   en `:root`; definí un bloque `[data-tema="noche"]` con los equivalentes oscuros y guardá la
   preferencia en `localStorage`. Los pasteles deben bajar saturación, no volverse fluorescentes.
3. **Campana de recordatorios**: icono en la cabecera con la cantidad de eventos de hoy que aún no
   pasaron más las tareas vencidas; al abrirla, la lista. Sin notificaciones del sistema por ahora.
4. **Importar respaldo**: leer el JSON que produce el botón ⤓ y volcarlo a las tablas del usuario actual.
5. **Aviso de sin conexión**: si una escritura falla por red, marcarla y reintentar.

**Cómo probar**
Levantá un servidor local (`npx serve oggi-app`) — abrir el archivo directamente no funciona por
las restricciones de módulos ES. Necesitás un proyecto de Supabase con el `esquema.sql` ya corrido
y los datos en `js/config.js`.
