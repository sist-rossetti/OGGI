# OGGI · cómo ponerlo en marcha

Escrito para alguien que nunca programó. Son cuatro pasos y toma unos 20 minutos.
No hace falta instalar nada en tu computadora.

---

## Qué hay en esta carpeta

```
oggi-app/
├── index.html          ← la página (esto es lo que se abre)
├── esquema.sql         ← se pega una sola vez en Supabase
├── js/
│   ├── config.js       ← el único archivo que TENÉS que editar
│   ├── db.js           ← habla con la base de datos
│   └── app.js          ← toda la aplicación
├── INSTRUCCIONES.md    ← este archivo
└── PROMPT-CLAUDE-CODE.md
```

---

## Paso 1 · Crear la base de datos (10 min)

1. Entrá a **supabase.com** y creá una cuenta gratis.
2. Botón **New project**. Ponele de nombre `oggi`.
3. Te va a pedir una contraseña para la base de datos: **anotala en algún lado**, no la vas a usar seguido pero la vas a necesitar si algo se rompe.
4. Elegí la región más cercana a vos y dale a crear. Tarda un par de minutos.
5. Cuando esté listo, en el menú de la izquierda entrá a **SQL Editor** → **New query**.
6. Abrí el archivo `esquema.sql` de esta carpeta, copiá **todo** el contenido y pegalo ahí.
7. Botón **Run** (o Ctrl+Enter). Tiene que decir *Success*.

Eso creó las tablas y —muy importante— las reglas de seguridad: cada persona solo puede ver sus propias filas. Sin eso, cualquiera podría leer los datos de los demás.

## Paso 2 · Conectar la app con tu base (2 min)

1. En Supabase, menú izquierdo → **Project Settings** → **API**.
2. Vas a ver dos cosas: **Project URL** y, más abajo, la clave **anon public**.
3. Abrí `js/config.js` con cualquier editor de texto (el Bloc de notas sirve).
4. Reemplazá los dos valores de ejemplo por los tuyos y guardá.

```js
export const SUPABASE_URL = 'https://abcdefgh.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
```

> La clave `anon` es pública a propósito, no es un secreto. Lo que protege los datos son las reglas del paso 1.
> **Nunca** pegues acá la clave `service_role`: esa sí es secreta y saltea toda la seguridad.

## Paso 3 · Configurar el correo de registro (2 min)

Por defecto Supabase le manda un correo de confirmación a cada persona que se registra.

- **Para probar rápido vos sola:** Authentication → Sign In / Providers → Email → desactivá *Confirm email*. Así entrás al instante.
- **Para abrirlo al público: dejalo activado.** Evita que alguien registre cuentas con correos ajenos.

Ojo: el servicio de correo gratuito de Supabase manda pocos mensajes por hora. Cuando tengas usuarios de verdad vas a necesitar conectar un servicio de correo (Resend, SendGrid) en Authentication → Emails → SMTP.

## Paso 4 · Publicar la app (5 min)

La app no necesita compilarse: son archivos sueltos.

**Opción fácil (recomendada):**
1. Entrá a **netlify.com** y creá una cuenta gratis.
2. En el panel, buscá **Add new site → Deploy manually**.
3. Arrastrá la carpeta `oggi-app` entera a esa zona.
4. Listo: te da una dirección tipo `oggi-xxxx.netlify.app`. Esa es tu app, funcionando, para cualquiera.

Para actualizarla después: arrastrás la carpeta de nuevo.

**Para probar antes en tu computadora:** abrir `index.html` haciendo doble clic **no funciona** (el navegador bloquea los archivos `.js` por seguridad). Necesitás un servidor local; lo más simple es publicarla en Netlify y probar ahí, o pedirle a Claude Code que la levante (`npx serve`).

---

## Cómo se usa

- Cada persona entra con **correo y contraseña**. La primera vez usa "Crear una cuenta nueva".
- Sus datos se guardan solos, al instante, y aparecen en cualquier dispositivo donde inicie sesión.
- El botón **⤓** de la cabecera descarga una copia de todos los datos en un archivo.

## Si algo no anda

| Qué ves | Qué pasa |
|---|---|
| Pantalla en blanco | `config.js` mal pegado. Revisá que las comillas estén completas. |
| "No se pudieron leer los datos" | El `esquema.sql` no se ejecutó, o se ejecutó a medias. Corrélo de nuevo entero. |
| Me registro y no puedo entrar | Falta confirmar el correo (paso 3). |
| Guarda pero no aparece nada | Las reglas de seguridad no se crearon. Volvé a correr el bloque final del `esquema.sql`. |

Para ver los datos con tus propios ojos: Supabase → **Table Editor**.

---

## Lo que todavía no está

1. **Modo noche** con interruptor sol/luna. Los colores ya están todos como variables al inicio de `index.html`, así que es un cambio acotado.
2. **Campana de recordatorios** dentro de la app.
3. **Importar** un respaldo (hoy solo se puede exportar).
4. **Borrar la cuenta** — si la abrís al público, esto deja de ser opcional: en varios países es obligatorio por ley de datos personales.
5. Los cambios se guardan uno por uno; si se corta internet en el medio, ese cambio se pierde. Un aviso de "sin conexión" sería lo próximo.

## Antes de abrirlo al público

- Poné un dominio propio y activá copias de seguridad en Supabase (Database → Backups).
- Escribí una política de privacidad, aunque sea corta: estás guardando datos personales de otras personas.
- Revisá el límite del plan gratuito de Supabase. Para cientos de usuarios alcanza; para miles, no.
