/* OGGI · aplicación
   Todo el estado vive en `estado`. Cualquier cambio llama a render().
   Los datos se leen una vez al entrar y se escriben en Supabase a medida que se editan. */

import * as db from './db.js';

/* ------------------------------------------------------------------ */
/* constantes de diseño                                                */
/* ------------------------------------------------------------------ */
const PAL = [
  { n: 'Amarillo', bg: '#FBF0BE', bar: '#EBD98A' },
  { n: 'Rosa',     bg: '#FADDE1', bar: '#EFBCC4' },
  { n: 'Celeste',  bg: '#D8E8F7', bar: '#AFCDEC' },
  { n: 'Verde',    bg: '#DCEFDF', bar: '#B4DCBC' },
  { n: 'Lila',     bg: '#E6DFF6', bar: '#C3B4E6' },
  { n: 'Durazno',  bg: '#FBE2CE', bar: '#F0C39B' }
];
// Las notas usan una paleta más amplia: los 6 primeros son los mismos de PAL
// (así las notas ya guardadas no cambian de color) y después vienen los extra.
const PAL_NOTAS = [...PAL,
  { n: 'Menta',    bg: '#D4F0EA', bar: '#A6DDD0' },
  { n: 'Coral',    bg: '#FBD5CF', bar: '#F2AFA4' },
  { n: 'Lavanda',  bg: '#DDE3F8', bar: '#B7C3EE' },
  { n: 'Lima',     bg: '#EAF3CF', bar: '#CFE29A' },
  { n: 'Arena',    bg: '#F1EAD9', bar: '#DDCFAF' },
  { n: 'Perla',    bg: '#ECECEF', bar: '#CFCFD6' }
];
// Tipografías de las notas. El orden importa: la nota guarda la posición.
// Los nombres van entre comillas simples porque se insertan dentro de style="…".
const FUENTES = [
  { n: 'Montserrat',       f: 'Montserrat, sans-serif',        s: '14px' },
  { n: 'Caveat',           f: 'Caveat, cursive',               s: '21px' },
  { n: 'Space Mono',       f: "'Space Mono', monospace",       s: '13px' },
  { n: 'Playfair Display', f: "'Playfair Display', serif",     s: '15px' },
  { n: 'Patrick Hand',     f: "'Patrick Hand', cursive",       s: '18px' },
  { n: 'Nunito',           f: 'Nunito, sans-serif',            s: '14px' },
  { n: 'Indie Flower',     f: "'Indie Flower', cursive",       s: '18px' }
];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MES3  = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DIAS  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const TAGS  = ['Personal','Trabajo','Estudio','Creativo'];
const CATS  = ['Comida','Transporte','Salud','Ocio','Otros'];
const NW = 206, NGAP = 18, NPAD = 14;

/* ------------------------------------------------------------------ */
/* utilidades                                                          */
/* ------------------------------------------------------------------ */
const pad = n => String(n).padStart(2, '0');
const kf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const lunesDe = d => { const diff = (d.getDay() + 6) % 7; return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff); };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
// Montos en formato es-AR: el punto separa miles y la coma es decimal
// ("1.600.000" → 1600000, "1.500,50" → 1500.5). Lo que ya viene como número
// desde la base se usa tal cual, sin volver a interpretarlo.
const num = v => {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  let s = String(v ?? '').replace(/[^\d.,-]/g, '');
  const puntos = (s.match(/\./g) || []).length, comas = (s.match(/,/g) || []).length;
  if (comas > 1) s = s.replace(/,/g, '');
  else if (comas === 1) s = s.replace(/\./g, '').replace(',', '.');
  else if (puntos > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};
const money = n => '$' + Math.round(n).toLocaleString('es-AR');
const pal = i => PAL[((i | 0) % 6 + 6) % 6];
const palNota = i => PAL_NOTAS[((i | 0) % PAL_NOTAS.length + PAL_NOTAS.length) % PAL_NOTAS.length];
const fuenteNota = i => FUENTES[((i | 0) % FUENTES.length + FUENTES.length) % FUENTES.length];
const fechaCorta = f => f ? (+String(f).slice(8) + ' ' + MES3[+String(f).slice(5,7) - 1]) : '';
const $ = s => document.querySelector(s);
const mesTexto = ym => MESES[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4);
const correrMes = (ym, n) => { const d = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
// Los gastos fijos creados antes de separar por mes no tienen "mes": cuentan
// en el mes (hora local) en que se crearon, igual que en esquema.sql.
const mesFijo = g => {
  if (g.mes) return g.mes;
  const d = new Date(g.creado_en);
  return isNaN(d) ? '' : d.getFullYear() + '-' + pad(d.getMonth() + 1);
};

/* ---------- modo noche ---------- */
function aplicarTema(t) {
  document.documentElement.setAttribute('data-tema', t);
}
const temaGuardado = localStorage.getItem('oggi-tema')
  || (matchMedia('(prefers-color-scheme: dark)').matches ? 'noche' : 'dia');
aplicarTema(temaGuardado);

function aviso(txt) {
  const el = $('#aviso');
  el.textContent = txt;
  el.classList.add('ver');
  clearTimeout(aviso._t);
  aviso._t = setTimeout(() => el.classList.remove('ver'), 2600);
}
async function seguro(fn) {
  try { await fn(); }
  catch (e) { console.error(e); aviso('No se pudo guardar: ' + (e.message || 'error de conexión')); }
}

db.alCambiarConexion(caido => {
  estado.ui.sinConexion = caido;
  aviso(caido ? 'Sin conexión: tus cambios se reintentarán solos.' : 'Conexión recuperada, guardando lo pendiente.');
  if (estado.datos) render();
});

/* ------------------------------------------------------------------ */
/* estado                                                              */
/* ------------------------------------------------------------------ */
const estado = {
  datos: null,
  ui: {
    pestana: 'inicio', ahora: new Date(), q: '',
    cursor: null, selDia: null, modoCal: 'mes', semana: null,
    proyecto: null, dibujo: null,
    notaColor: 0, notaFuente: 1,
    tareaEtq: 'Personal', tareaFiltro: 'Todas',
    evColor: 2, varCat: 'Comida',
    borradores: {},
    modoAcceso: 'entrar', errorAcceso: '',
    tema: temaGuardado, panelRecordatorios: false, panelCuenta: false,
    sinConexion: false, habitosSemana: null,
    modoHab: 'semana', paletaNota: null, apunte: null, habitosMes: null, mesDinero: null, editando: null
  }
};
const b = (k, v) => { if (v !== undefined) estado.ui.borradores[k] = v; return estado.ui.borradores[k] ?? ''; };
const limpiar = (...ks) => ks.forEach(k => { estado.ui.borradores[k] = ''; });
const D = () => estado.datos;
const mesActual = () => kf(estado.ui.ahora).slice(0, 7);
const mesDinero = () => estado.ui.mesDinero || mesActual();
// Fecha que se guarda al cargar algo mientras se mira otro mes.
const fechaParaMes = ym => ym === mesActual() ? kf(estado.ui.ahora) : ym + '-01';

/* ---------- edición en el lugar ----------
   Un clic sobre un texto ya guardado lo convierte en campo: Enter o salir
   del campo guarda, Escape cancela. */
function editable(tabla, id, campo, valor) {
  const e = estado.ui.editando, esMonto = campo === 'monto';
  if (e && e.tabla === tabla && e.id === id && e.campo === campo) {
    const v = esMonto ? (num(valor) ? num(valor).toLocaleString('es-AR') : '') : valor;
    return `<input class="campo" data-f="edit" data-edicion value="${esc(v)}" style="padding:4px 8px;font-size:inherit;border-radius:8px;${esMonto ? 'width:120px;text-align:right' : ''}">`;
  }
  return `<span data-editar="${tabla}|${id}|${campo}" title="Clic para editar" style="cursor:text">${esMonto ? money(num(valor)) : esc(valor)}</span>`;
}
function guardarEdicion(input, diferir = false) {
  const e = estado.ui.editando;
  if (!e) return;
  estado.ui.editando = null;
  const fila = D()[e.tabla].find(x => x.id === e.id);
  const valor = e.campo === 'monto' ? num(input.value) : input.value.trim();
  const cambio = fila && valor !== '' && valor !== fila[e.campo];
  if (cambio) fila[e.campo] = valor;
  if (!diferir) render();
  else {
    // El foco se fue con un clic: se cambia solo el campo, sin redibujar todo,
    // para que ese clic llegue a su botón. El resto se redibuja al soltar.
    if (fila) input.outerHTML = editable(e.tabla, e.id, e.campo, fila[e.campo]);
    addEventListener('mouseup', () => setTimeout(render), { once: true });
  }
  if (cambio) seguro(() => db.actualizar(e.tabla, e.id, { [e.campo]: valor }));
}
let mouseApretado = false;
addEventListener('mousedown', () => { mouseApretado = true; }, true);
addEventListener('mouseup', () => { mouseApretado = false; }, true);

/* ------------------------------------------------------------------ */
/* arranque                                                            */
/* ------------------------------------------------------------------ */
(async function inicio() {
  // Se escucha antes de leer la sesión para no perderse el aviso que llega
  // al abrir el enlace de "Olvidé mi contraseña" desde el correo.
  if (/type=recovery/.test(location.hash)) estado.ui.modoAcceso = 'nueva';
  db.sb.auth.onAuthStateChange((ev) => {
    if (ev === 'SIGNED_OUT') { estado.datos = null; mostrarAcceso(); }
    if (ev === 'PASSWORD_RECOVERY') { estado.ui.modoAcceso = 'nueva'; estado.datos = null; mostrarAcceso(); }
  });
  const s = await db.sesion();
  if (s && estado.ui.modoAcceso !== 'nueva') await cargar(); else mostrarAcceso();
  setInterval(() => {
    estado.ui.ahora = new Date();
    if (estado.datos && estado.ui.pestana === 'inicio') pintarReloj();
  }, 1000);
})();

async function cargar() {
  $('#cargando').classList.remove('oculto');
  try {
    estado.datos = await db.traerTodo();
    const n = new Date();
    estado.ui.cursor = { y: n.getFullYear(), m: n.getMonth() };
    estado.ui.semana = kf(new Date(n.getFullYear(), n.getMonth(), n.getDate() - n.getDay()));
    $('#acceso').classList.add('oculto');
    $('#app').classList.remove('oculto');
    render();
  } catch (e) {
    console.error(e);
    aviso('No se pudieron leer los datos. Revisá config.js y el esquema.sql.');
  } finally {
    $('#cargando').classList.add('oculto');
  }
}

/* ------------------------------------------------------------------ */
/* pantalla de acceso                                                  */
/* ------------------------------------------------------------------ */
function mostrarAcceso() {
  $('#cargando').classList.add('oculto');
  $('#app').classList.add('oculto');
  const el = $('#acceso');
  el.classList.remove('oculto');
  const crear = estado.ui.modoAcceso === 'crear';
  if (estado.ui.modoAcceso === 'nueva') return mostrarNuevaPassword(el);
  el.innerHTML = `
    <div class="blob1"></div><div class="blob2"></div>
    <div class="caja">
      <div class="marca" style="margin-bottom:26px"><i></i><span>OGGI</span></div>
      <div style="font-size:15px;font-weight:500;margin-bottom:4px">${crear ? 'Creá tu cuenta' : 'Bienvenida de nuevo'}</div>
      <div style="font-size:13px;color:var(--txt3);line-height:1.5;margin-bottom:22px">Tu día, tus notas y tus proyectos en un solo lugar.</div>
      <form id="fAcceso" style="display:flex;flex-direction:column;gap:10px">
        ${crear ? `<input class="campo" name="nombre" placeholder="Tu nombre" autocomplete="name">` : ''}
        <input class="campo" name="email" type="email" placeholder="Correo" autocomplete="email" required>
        <input class="campo" name="password" type="password" placeholder="Contraseña" autocomplete="${crear ? 'new-password' : 'current-password'}" required minlength="6">
        ${estado.ui.errorAcceso ? `<div style="font-size:12px;color:var(--peligro);padding:0 2px">${esc(estado.ui.errorAcceso)}</div>` : ''}
        <button class="primario" style="padding:14px;margin-top:4px" type="submit">${crear ? 'Crear cuenta y entrar' : 'Entrar'}</button>
      </form>
      <button id="cambiarModo" style="border:none;background:transparent;font-size:12px;color:#8A8A90;padding:8px;cursor:pointer;width:100%">${crear ? 'Ya tengo cuenta' : 'Crear una cuenta nueva'}</button>
      ${crear ? '' : `<button id="olvide" style="border:none;background:transparent;font-size:12px;color:var(--txt5);padding:0 8px 8px;cursor:pointer;width:100%">Olvidé mi contraseña</button>`}
      <div style="margin-top:18px;padding-top:18px;border-top:1px solid var(--borde-suave);font-size:11px;line-height:1.6;color:var(--txt5)">Tus datos son solo tuyos: nadie más puede leerlos, ni siquiera otras personas con cuenta en OGGI.</div>
    </div>`;

  $('#cambiarModo').onclick = () => {
    estado.ui.modoAcceso = crear ? 'entrar' : 'crear';
    estado.ui.errorAcceso = '';
    mostrarAcceso();
  };
  const olv = $('#olvide');
  if (olv) olv.onclick = async () => {
    const email = $('#fAcceso').email.value.trim();
    if (!email) { estado.ui.errorAcceso = 'Escribí tu correo primero.'; return mostrarAcceso(); }
    try { await db.recuperar(email); aviso('Te mandamos un correo para recuperar la contraseña.'); }
    catch (e) { estado.ui.errorAcceso = traducir(e.message); mostrarAcceso(); }
  };
  $('#fAcceso').onsubmit = async ev => {
    ev.preventDefault();
    const f = ev.target;
    const email = f.email.value.trim(), pass = f.password.value;
    $('#cargando').classList.remove('oculto');
    try {
      if (crear) {
        const r = await db.registrarse(email, pass, f.nombre.value.trim());
        if (!r.session) {
          $('#cargando').classList.add('oculto');
          estado.ui.errorAcceso = '';
          aviso('Revisá tu correo para confirmar la cuenta.');
          return;
        }
      } else {
        await db.entrar(email, pass);
      }
      estado.ui.errorAcceso = '';
      await cargar();
    } catch (e) {
      $('#cargando').classList.add('oculto');
      estado.ui.errorAcceso = traducir(e.message);
      mostrarAcceso();
    }
  };
}
// Pantalla a la que se llega desde el enlace de recuperación del correo:
// la sesión ya está abierta, solo falta elegir la contraseña nueva.
function mostrarNuevaPassword(el) {
  el.innerHTML = `
    <div class="blob1"></div><div class="blob2"></div>
    <div class="caja">
      <div class="marca" style="margin-bottom:26px"><i></i><span>OGGI</span></div>
      <div style="font-size:15px;font-weight:500;margin-bottom:22px">Elegí una contraseña nueva</div>
      <form id="fNueva" style="display:flex;flex-direction:column;gap:10px">
        <input class="campo" name="password" type="password" placeholder="Contraseña nueva" autocomplete="new-password" required minlength="6">
        ${estado.ui.errorAcceso ? `<div style="font-size:12px;color:var(--peligro);padding:0 2px">${esc(estado.ui.errorAcceso)}</div>` : ''}
        <button class="primario" style="padding:14px;margin-top:4px" type="submit">Guardar y entrar</button>
      </form>
    </div>`;
  $('#fNueva').onsubmit = async ev => {
    ev.preventDefault();
    $('#cargando').classList.remove('oculto');
    try {
      await db.cambiarPassword(ev.target.password.value);
      estado.ui.modoAcceso = 'entrar';
      estado.ui.errorAcceso = '';
      history.replaceState(null, '', location.pathname + location.search);
      await cargar();
      aviso('Tu contraseña fue actualizada.');
    } catch (e) {
      $('#cargando').classList.add('oculto');
      estado.ui.errorAcceso = traducir(e.message);
      mostrarAcceso();
    }
  };
}
function traducir(m = '') {
  if (/invalid login/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/already registered/i.test(m)) return 'Ese correo ya tiene cuenta.';
  if (/at least 6/i.test(m)) return 'La contraseña necesita al menos 6 caracteres.';
  if (/rate limit/i.test(m)) return 'Demasiados intentos. Probá en un minuto.';
  if (/different from the old/i.test(m)) return 'La contraseña nueva tiene que ser distinta de la anterior.';
  return m || 'Algo salió mal.';
}

/* ------------------------------------------------------------------ */
/* render                                                              */
/* ------------------------------------------------------------------ */
const PESTANAS = [
  ['inicio','Inicio'], ['calendario','Calendario'], ['tareas','Tareas'],
  ['proyectos','Proyectos'], ['habitos','Hábitos'], ['dinero','Dinero'], ['apuntes','Notas']
];

function render() {
  if (!estado.datos) return;
  const foco = document.activeElement?.dataset?.f;
  const pos = document.activeElement?.selectionStart;
  const scroll = document.activeElement?.scrollTop;
  const u = estado.ui;
  const vistas = { inicio: vInicio, calendario: vCalendario, tareas: vTareas, proyectos: vProyectos, habitos: vHabitos, dinero: vDinero, apuntes: vApuntes };
  const recs = recordatorios();

  $('#app').innerHTML = `
    <header><div class="fila">
      <div class="marca"><i style="width:26px;height:26px;border-radius:9px"></i><span style="font-size:15px;letter-spacing:.14em;text-transform:uppercase">OGGI</span></div>
      <nav>${PESTANAS.map(([k, t]) => `<button class="${u.pestana === k ? 'on' : ''}" data-tab="${k}">${t}</button>`).join('')}</nav>
      <div style="position:relative;display:flex;align-items:center;gap:8px">
        <input id="buscador" data-f="q" placeholder="Buscar en todo…" value="${esc(u.q)}">
        ${u.q.trim() ? buscar() : ''}
        ${u.sinConexion ? `<span title="Sin conexión: tus cambios se reintentarán solos" style="font-size:16px">📡</span>` : ''}
        <div class="campana" data-panel>
          <button class="redondo" data-acc="panelRecordatorios" title="Recordatorios">🔔</button>
          ${recs.length ? `<span class="punto">${recs.length}</span>` : ''}
          ${u.panelRecordatorios ? panelRecordatoriosHTML(recs) : ''}
        </div>
        <button class="redondo" data-acc="tema" title="${u.tema === 'noche' ? 'Modo día' : 'Modo noche'}">${u.tema === 'noche' ? '☀' : '☾'}</button>
        <div style="position:relative" data-panel>
          <button class="redondo" data-acc="panelCuenta" title="Cuenta">⚙</button>
          ${u.panelCuenta ? panelCuentaHTML() : ''}
        </div>
        <input type="file" id="importFile" accept="application/json" style="display:none">
      </div>
    </div></header>
    <main>${vistas[u.pestana]()}</main>`;

  if (foco) {
    const el = $(`[data-f="${foco}"]`);
    if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) {} if (scroll) el.scrollTop = scroll; }
  }
  if (u.pestana === 'inicio') { colocarNotas(); pintarReloj(); }
}

/* ---------- recordatorios ---------- */
function recordatorios() {
  const d = D(), n = estado.ui.ahora, hoy = kf(n);
  const manana = kf(new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1));
  const r = [];
  d.eventos.filter(e => e.fecha === hoy).sort((a, x) => (a.hora ?? 24) - (x.hora ?? 24)).forEach(e =>
    r.push({ texto: e.titulo, detalle: 'Hoy' + (e.hora != null ? ' · ' + pad(e.hora) + ':00' : ''), color: pal(e.color).bar, ir: { pestana: 'calendario', selDia: e.fecha } }));
  d.eventos.filter(e => e.fecha === manana).sort((a, x) => (a.hora ?? 24) - (x.hora ?? 24)).forEach(e =>
    r.push({ texto: e.titulo, detalle: 'Mañana' + (e.hora != null ? ' · ' + pad(e.hora) + ':00' : ''), color: pal(e.color).bar, ir: { pestana: 'calendario', selDia: e.fecha } }));
  d.proyectos.forEach(p => {
    if (!p.vence) return;
    const dif = Math.round((new Date(p.vence + 'T00:00:00') - new Date(hoy + 'T00:00:00')) / 864e5);
    if (dif < 0) r.push({ texto: p.nombre, detalle: 'Proyecto atrasado', color: 'var(--peligro)', ir: { pestana: 'proyectos', proyecto: p.id } });
    else if (dif <= 3) r.push({ texto: p.nombre, detalle: dif === 0 ? 'Proyecto vence hoy' : `Proyecto vence en ${dif} día${dif === 1 ? '' : 's'}`, color: pal(p.color).bar, ir: { pestana: 'proyectos', proyecto: p.id } });
  });
  return r;
}
function panelRecordatoriosHTML(recs) {
  return `<div class="panel-flot">
    <div class="mini" style="margin-bottom:10px">Recordatorios</div>
    ${recs.length ? recs.map(x => `<button data-ir='${esc(JSON.stringify(x.ir))}' style="width:100%;text-align:left;border:none;background:transparent;cursor:pointer;border-radius:12px;padding:10px 8px;display:flex;gap:10px;align-items:center;color:var(--txt)">
      <span style="flex:0 0 auto;width:8px;height:8px;border-radius:50%;background:${x.color}"></span>
      <span style="flex:1;min-width:0">
        <span style="display:block;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.texto)}</span>
        <span style="display:block;font-size:11px;color:var(--txt4);margin-top:2px">${esc(x.detalle)}</span>
      </span>
    </button>`).join('') : '<div style="padding:10px 8px;font-size:12px;color:var(--txt4)">Sin novedades por ahora.</div>'}
  </div>`;
}
function panelCuentaHTML() {
  return `<div class="panel-flot" style="width:230px">
    <div class="mini" style="margin-bottom:10px">Cuenta</div>
    <button class="pill" style="width:100%;margin-bottom:8px;text-align:left" data-acc="exportar">⤓ Respaldar mis datos</button>
    <button class="pill" style="width:100%;margin-bottom:8px;text-align:left" data-acc="importarClick">⤒ Importar un respaldo</button>
    <button class="pill" style="width:100%;margin-bottom:8px;text-align:left;color:var(--peligro)" data-acc="borrarTodo">Borrar todos mis datos</button>
    <button class="pill" style="width:100%;margin-bottom:8px;text-align:left;color:var(--peligro)" data-acc="borrarCuenta">Eliminar mi cuenta</button>
    <div style="border-top:1px solid var(--borde-suave);margin:10px 0"></div>
    <button class="pill" style="width:100%;text-align:left" data-acc="salir">Cerrar sesión</button>
  </div>`;
}

/* ---------- búsqueda ---------- */
function buscar() {
  const q = estado.ui.q.trim().toLowerCase();
  const d = D(), hit = s => (s || '').toLowerCase().includes(q), r = [];
  d.notas.filter(n => hit(n.texto)).forEach(n => r.push([n.texto.slice(0, 60) || 'Nota vacía', 'Nota', palNota(n.color).bar, { pestana: 'inicio' }]));
  d.eventos.filter(e => hit(e.titulo)).forEach(e => r.push([e.titulo, 'Evento · ' + fechaCorta(e.fecha), pal(e.color).bar, { pestana: 'calendario', selDia: e.fecha }]));
  d.tareas.filter(t => hit(t.texto)).forEach(t => r.push([t.texto, 'Tarea · ' + t.etiqueta, '#B4DCBC', { pestana: 'tareas' }]));
  d.proyectos.forEach(p => {
    if (hit(p.nombre) || hit(p.descripcion)) r.push([p.nombre, 'Proyecto', pal(p.color).bar, { pestana: 'proyectos', proyecto: p.id }]);
    d.proyecto_pasos.filter(s => s.proyecto_id === p.id && hit(s.texto)).forEach(s => r.push([s.texto, 'Paso · ' + p.nombre, pal(p.color).bar, { pestana: 'proyectos', proyecto: p.id }]));
    d.proyecto_notas.filter(s => s.proyecto_id === p.id && hit(s.texto)).forEach(s => r.push([s.texto, 'Nota · ' + p.nombre, pal(p.color).bar, { pestana: 'proyectos', proyecto: p.id }]));
  });
  d.habitos.filter(h => hit(h.nombre)).forEach(h => r.push([h.nombre, 'Hábito', pal(h.color).bar, { pestana: 'habitos' }]));
  d.gastos_fijos.filter(g => hit(g.nombre)).forEach(g => r.push([g.nombre, 'Gasto fijo', pal(g.color).bar, { pestana: 'dinero' }]));
  d.gastos_variables.filter(g => hit(g.nombre)).forEach(g => r.push([g.nombre, 'Gasto · ' + g.categoria, '#EFBCC4', { pestana: 'dinero' }]));
  d.apuntes.filter(a => hit(a.texto)).forEach(a => r.push([tituloApunte(a), 'Nota de texto', '#C3B4E6', { pestana: 'apuntes', apunte: a.id }]));
  d.ingresos.filter(i => hit(i.origen) || hit(i.detalle)).forEach(i => r.push([i.origen, 'Ingreso', '#B4DCBC', { pestana: 'dinero' }]));

  return `<div id="resultados">${r.length ? r.map(([t, m, c, ir]) => `
    <button data-ir='${esc(JSON.stringify(ir))}'>
      <span style="flex:0 0 auto;width:8px;height:8px;border-radius:50%;background:${c}"></span>
      <span style="flex:1;min-width:0">
        <span style="display:block;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t)}</span>
        <span style="display:block;font-size:11px;color:var(--txt4);margin-top:2px">${esc(m)}</span>
      </span>
    </button>`).join('') : '<div style="padding:14px;font-size:12px;color:var(--txt4)">Sin resultados.</div>'}</div>`;
}

/* ------------------------------------------------------------------ */
/* INICIO                                                              */
/* ------------------------------------------------------------------ */
function vInicio() {
  const d = D(), hoy = kf(estado.ui.ahora);
  const evs = [...d.eventos].sort((a, x) => (a.fecha + pad(a.hora ?? 99)).localeCompare(x.fecha + pad(x.hora ?? 99)));
  const rel = f => {
    const dif = Math.round((new Date(f + 'T00:00:00') - new Date(hoy + 'T00:00:00')) / 864e5);
    if (dif === 0) return 'Hoy';
    if (dif === 1) return 'Mañana';
    const dd = new Date(f + 'T00:00:00');
    return DIAS[dd.getDay()] + ' ' + dd.getDate() + ' ' + MES3[dd.getMonth()];
  };
  const prox = evs.filter(e => e.fecha >= hoy).slice(0, 4);

  return `<div class="dos">
    <section class="izq" style="display:flex;flex-direction:column;gap:18px">
      <div class="tarjeta" style="padding:26px 22px;display:flex;flex-direction:column;align-items:center;gap:16px">
        <div style="display:flex;align-items:flex-end;gap:6px">
          <div id="reloj" style="font-size:62px;font-weight:200;letter-spacing:-.02em;line-height:.9;font-variant-numeric:tabular-nums"></div>
          <div id="segs" style="font-size:22px;font-weight:300;color:var(--seg);line-height:1.6;font-variant-numeric:tabular-nums"></div>
        </div>
        <div style="width:100%;height:1px;background:var(--borde-suave)"></div>
        <div id="fecha" style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--txt3)"></div>
      </div>

      <div class="tarjeta" style="padding:22px">
        <div style="display:flex;align-items:center;gap:9px;margin-bottom:16px">
          <div style="width:8px;height:8px;border-radius:50%;background:var(--alerta);animation:softpulse 2.4s ease-in-out infinite"></div>
          <div class="rotulo">Próximos eventos</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${prox.length ? prox.map(e => {
            const dd = new Date(e.fecha + 'T00:00:00');
            const ya = e.fecha === hoy && (e.hora == null || e.hora >= estado.ui.ahora.getHours());
            return `<div class="pastel" style="display:flex;gap:12px;align-items:center;padding:12px 14px;border-radius:16px;background:${pal(e.color).bg}">
              <div style="flex:0 0 54px;text-align:center">
                <div style="font-size:19px;font-weight:600;line-height:1">${dd.getDate()}</div>
                <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--txt2);margin-top:3px">${MES3[dd.getMonth()]}</div>
              </div>
              <div style="flex:1;min-width:0">
                <div style="font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.titulo)}</div>
                <div style="font-size:12px;color:var(--txt2);margin-top:2px">${ya ? '⏰ ' : ''}${rel(e.fecha)}${e.hora == null ? '' : ' · ' + pad(e.hora) + ':00'}</div>
              </div>
            </div>`;
          }).join('') : '<div style="padding:18px 4px;font-size:13px;color:var(--txt4)">Sin eventos próximos. Agregalos desde Calendario.</div>'}
        </div>
      </div>

      <div class="tarjeta" style="padding:22px;display:flex;gap:14px">
        <div style="flex:1">
          <div style="font-size:26px;font-weight:300">${d.tareas.filter(t => !t.hecha).length}</div>
          <div class="mini" style="letter-spacing:.12em;margin-top:4px">Tareas pendientes</div>
        </div>
        <div style="width:1px;background:var(--borde)"></div>
        <div style="flex:1">
          <div style="font-size:26px;font-weight:300">${d.proyectos.length}</div>
          <div class="mini" style="letter-spacing:.12em;margin-top:4px">Proyectos activos</div>
        </div>
      </div>
    </section>

    <section class="der">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:18px">
        <div class="rotulo" style="margin-right:auto">Notas</div>
        <div style="display:flex;gap:7px;flex-wrap:wrap">
          ${PAL_NOTAS.map((p, i) => `<button data-acc="notaColor" data-i="${i}" title="${p.n}" style="width:22px;height:22px;border-radius:50%;cursor:pointer;background:${p.bg};border:2px solid ${estado.ui.notaColor === i ? '#8A8A90' : 'transparent'}"></button>`).join('')}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${FUENTES.map((f, i) => `<button data-acc="notaFuente" data-i="${i}" title="${f.n}" style="cursor:pointer;border:1px solid ${estado.ui.notaFuente === i ? '#D6D6DA' : 'var(--borde)'};background:${estado.ui.notaFuente === i ? 'var(--borde-suave)' : 'var(--card)'};border-radius:999px;padding:6px 14px;font-size:13px;font-family:${f.f}">Aa</button>`).join('')}
        </div>
        <button class="pill" data-acc="alinear">Alinear</button>
        <button class="primario" style="border-radius:999px;padding:10px 20px;font-size:13px" data-acc="nuevaNota">+ Nueva nota</button>
      </div>
      <div id="tablero">${d.notas.map(nota).join('')}</div>
    </section>
  </div>`;
}

function pintarReloj() {
  const n = estado.ui.ahora, r = $('#reloj');
  if (!r) return;
  r.textContent = pad(n.getHours()) + ':' + pad(n.getMinutes());
  $('#segs').textContent = pad(n.getSeconds());
  $('#fecha').textContent = DIAS[n.getDay()] + ' ' + n.getDate() + ' de ' + MESES[n.getMonth()];
}

function nota(n) {
  const f = fuenteNota(n.fuente);
  const paleta = estado.ui.paletaNota === n.id;
  const dibujando = estado.ui.dibujo === n.id;
  return `<div class="nota pastel" data-nota="${n.id}" style="background:${palNota(n.color).bg};z-index:${n.z || 1}">
    <div class="asa" data-arrastrar="${n.id}"><i></i></div>
    <textarea data-f="nota-${n.id}" data-texto="${n.id}" placeholder="Escribí acá…" style="font-family:${f.f};font-size:${f.s}">${esc(n.texto)}</textarea>
    <svg viewBox="0 0 ${NW} ${NW}">${(n.trazos || []).map(t => `<polyline points="${esc(t.pts)}" fill="none" stroke="${esc(t.color)}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></polyline>`).join('')}</svg>
    ${dibujando ? `<div class="lienzo" data-dibujar="${n.id}"></div>` : ''}
    ${paleta ? `<div class="paleta">${PAL_NOTAS.map((p, i) => `<button class="sw" data-notacolor="${n.id}" data-i="${i}" title="${p.n}" style="background:${p.bg};${(n.color | 0) === i ? 'border-color:#8A8A90' : ''}"></button>`).join('')}</div>` : ''}
    <div class="pie">
      <button class="sw" data-paleta="${n.id}" title="Color" style="background:${palNota(n.color).bg};border-color:rgba(0,0,0,.25)"></button>
      <button class="icono" data-modo-dibujo="${n.id}" title="Dibujar" style="margin-left:auto;font-size:11px;border-radius:6px;padding:4px 6px;background:${dibujando ? 'rgba(255,255,255,.75)' : 'transparent'};color:${dibujando ? '#4A4A4E' : 'var(--txt3)'}">✎</button>
      <button class="icono" data-borrar-dibujo="${n.id}" title="Borrar dibujo" style="font-size:11px">⌫</button>
      <button class="icono" data-fuente="${n.id}" title="Tipografía: ${f.n}" style="font-size:12px;color:#7A7A80;font-family:${f.f}">Aa</button>
      <button class="icono" data-borrar-nota="${n.id}" style="font-size:14px;color:var(--txt3)">×</button>
    </div>
  </div>`;
}

function colocarNotas() {
  const t = $('#tablero');
  if (!t) return;
  const ancho = t.clientWidth;
  const cols = Math.max(1, Math.floor((ancho - NPAD * 2 + NGAP) / (NW + NGAP)));
  let maxY = 0;
  D().notas.forEach((n, i) => {
    const el = t.querySelector(`[data-nota="${n.id}"]`);
    if (!el) return;
    const x = n.x ?? (NPAD + (i % cols) * (NW + NGAP));
    const y = n.y ?? (NPAD + Math.floor(i / cols) * (NW + NGAP));
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    maxY = Math.max(maxY, y);
  });
  const filas = Math.max(1, Math.ceil(D().notas.length / cols));
  t.style.height = Math.max(filas * (NW + NGAP) + NPAD * 2 - NGAP, maxY + NW + NPAD, 240) + 'px';
}

/* ------------------------------------------------------------------ */
/* CALENDARIO                                                          */
/* ------------------------------------------------------------------ */
function vCalendario() {
  const u = estado.ui, d = D(), hoy = kf(u.ahora);
  const evs = [...d.eventos].sort((a, x) => (a.fecha + pad(a.hora ?? 99)).localeCompare(x.fecha + pad(x.hora ?? 99)));
  const seg = `<div class="segmento">
    ${[['mes','Mes'],['semana','Semana']].map(([k, t]) => `<button class="${u.modoCal === k ? 'on' : ''}" data-acc="modoCal" data-i="${k}">${t}</button>`).join('')}
  </div>`;

  let principal = '';
  if (u.selDia) {
    const sd = new Date(u.selDia + 'T00:00:00');
    const del = evs.filter(e => e.fecha === u.selDia);
    const bloque = e => `<div class="bloque pastel" draggable="true" data-ev="${e.id}" style="background:${pal(e.color).bg}">
      <span>${esc(e.titulo)}</span><button class="icono" data-borrar-ev="${e.id}" style="font-size:14px">×</button></div>`;
    const horas = [];
    const conHora = del.filter(e => e.hora != null).map(e => e.hora);
    const desde = Math.min(7, ...conHora), hasta = Math.max(22, ...conHora);
    for (let h = desde; h <= hasta; h++) {
      horas.push(`<div class="hora" data-drop="${h}">
        <div style="flex:0 0 56px;font-size:11px;color:var(--txt4);padding-top:6px">${pad(h)}:00</div>
        <div style="flex:1;display:flex;gap:8px;flex-wrap:wrap">${del.filter(e => e.hora === h).map(bloque).join('')}</div>
      </div>`);
    }
    principal = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap">
        <button class="pill" data-acc="cerrarDia">‹ Mes</button>
        <div style="font-size:20px;font-weight:500">${DIAS[sd.getDay()]} ${sd.getDate()} de ${MESES[sd.getMonth()]}</div>
        <div style="margin-left:auto;font-size:12px;color:var(--txt4)">Arrastrá los bloques entre horas</div>
      </div>
      <div data-drop="null" style="border:1px dashed #E4E4E8;border-radius:16px;padding:12px;margin-bottom:16px;min-height:60px">
        <div class="mini" style="margin-bottom:8px">Sin hora</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${del.filter(e => e.hora == null).map(bloque).join('')}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;max-height:520px;overflow-y:auto;padding-right:4px">${horas.join('')}</div>`;
  } else if (u.modoCal === 'semana') {
    const ws = new Date(u.semana + 'T00:00:00');
    const we = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 6);
    principal = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
        <div style="font-size:20px;font-weight:500;margin-right:auto">${ws.getDate()} ${MES3[ws.getMonth()]} — ${we.getDate()} ${MES3[we.getMonth()]}</div>
        ${seg}
        <button class="redondo" data-acc="semana" data-i="-1">‹</button>
        <button class="redondo" data-acc="semana" data-i="1">›</button>
      </div>
      <div class="grid7">${Array.from({ length: 7 }, (_, i) => {
        const dd = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + i), k = kf(dd), es = k === hoy;
        return `<div class="dia" data-dia="${k}" style="min-height:250px;border-radius:16px;padding:12px 10px;${es ? 'background:var(--sel-bg);border-color:#C9DCF0' : ''}">
          <div style="text-align:center">
            <div class="mini" style="letter-spacing:.12em">${DIAS[dd.getDay()].slice(0,3)}</div>
            <div style="font-size:17px;font-weight:${es ? 700 : 400};margin-top:3px">${dd.getDate()}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:5px">${evs.filter(e => e.fecha === k).map(e => `
            <div class="pastel" style="background:${pal(e.color).bg};border-radius:9px;padding:6px 8px">
              <div style="font-size:10px;color:var(--txt2)">${e.hora == null ? 'Sin hora' : pad(e.hora) + ':00'}</div>
              <div style="font-size:11px;line-height:1.3">${esc(e.titulo)}</div>
            </div>`).join('')}</div>
        </div>`;
      }).join('')}</div>`;
  } else {
    const c = u.cursor, first = new Date(c.y, c.m, 1);
    const start = new Date(c.y, c.m, 1 - first.getDay());
    principal = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
        <div style="font-size:20px;font-weight:500;margin-right:auto">${MESES[c.m]} ${c.y}</div>
        ${seg}
        ${c.y === u.ahora.getFullYear() && c.m === u.ahora.getMonth() ? '' : `<button class="pill" data-acc="mesHoy">Hoy</button>`}
        <button class="redondo" data-acc="mes" data-i="-1">‹</button>
        <button class="redondo" data-acc="mes" data-i="1">›</button>
      </div>
      <div class="grid7" style="margin-bottom:8px">${['D','L','M','M','J','V','S'].map(x => `<div class="mini" style="text-align:center;letter-spacing:.14em">${x}</div>`).join('')}</div>
      <div class="grid7">${Array.from({ length: 42 }, (_, i) => {
        const dd = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        const k = kf(dd), fuera = dd.getMonth() !== c.m, es = k === hoy;
        const lista = evs.filter(e => e.fecha === k).slice(0, 3);
        return `<div class="dia ${es ? 'hoy' : ''} ${fuera ? 'fuera' : ''}" data-dia="${k}">
          <div style="font-size:13px;font-weight:${es ? 700 : 500}">${dd.getDate()}</div>
          <div style="display:flex;flex-direction:column;gap:3px;width:100%">
            ${lista.map(e => `<div class="chip" style="background:${pal(e.color).bg}">${esc(e.titulo)}</div>`).join('')}
          </div>
        </div>`;
      }).join('')}</div>`;
  }

  const c = u.cursor;
  const delMes = evs.filter(e => e.fecha.slice(0, 7) === c.y + '-' + pad(c.m + 1));
  return `<div class="cal">
    <section class="principal tarjeta" style="padding:24px">${principal}</section>
    <section class="lateral tarjeta" style="padding:24px">
      <div class="rotulo" style="margin-bottom:16px">Agregar al calendario</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <input class="campo" data-f="evT" data-b="evT" placeholder="¿Qué vas a hacer?" value="${esc(b('evT'))}">
        <div style="display:flex;gap:10px">
          <input class="campo" type="date" data-f="evF" data-b="evF" value="${esc(b('evF') || hoy)}">
          <input class="campo" type="time" data-f="evH" data-b="evH" style="flex:0 0 116px" value="${esc(b('evH'))}">
        </div>
        <div style="display:flex;gap:7px;padding:2px 0">
          ${PAL.map((p, i) => `<button data-acc="evColor" data-i="${i}" style="width:22px;height:22px;border-radius:50%;cursor:pointer;background:${p.bg};border:2px solid ${u.evColor === i ? '#8A8A90' : 'transparent'}"></button>`).join('')}
        </div>
        <button class="primario" data-acc="addEvento">Guardar en el calendario</button>
      </div>
      <div style="height:1px;background:var(--borde);margin:22px 0"></div>
      <div class="mini" style="margin-bottom:12px">En ${MESES[c.m].toLowerCase()}</div>
      <div style="display:flex;flex-direction:column;gap:8px;max-height:360px;overflow-y:auto">
        ${delMes.map(e => `<div class="pastel" style="display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:14px;background:${pal(e.color).bg}">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${editable('eventos', e.id, 'titulo', e.titulo)}</div>
            <div style="font-size:11px;color:var(--txt2);margin-top:2px">${fechaCorta(e.fecha)}${e.hora == null ? '' : ' · ' + pad(e.hora) + ':00'}</div>
          </div>
          <button class="icono" data-borrar-ev="${e.id}">×</button>
        </div>`).join('')}
      </div>
    </section>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* TAREAS                                                              */
/* ------------------------------------------------------------------ */
function vTareas() {
  const u = estado.ui, d = D();
  const vis = d.tareas.filter(t => u.tareaFiltro === 'Todas' || t.etiqueta === u.tareaFiltro);
  return `<div style="max-width:760px;margin:0 auto">
    <div style="display:flex;align-items:baseline;gap:14px;margin-bottom:20px;flex-wrap:wrap">
      <div style="font-size:22px;font-weight:500">Tareas</div>
      <div style="font-size:12px;color:var(--txt4)">${d.tareas.filter(t => !t.hecha).length} pendientes · ${d.tareas.filter(t => t.hecha).length} listas</div>
      <button class="pill" style="margin-left:auto" data-acc="limpiarTareas">Limpiar completadas</button>
    </div>
    <div style="display:flex;gap:10px;margin-bottom:12px">
      <input class="campo" style="border-radius:16px;padding:14px 16px;background:var(--card)" data-f="tarea" data-b="tarea" data-enter="addTarea" placeholder="Nueva tarea…" value="${esc(b('tarea'))}">
      <button class="primario" style="border-radius:16px;padding:0 24px" data-acc="addTarea">+</button>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;align-items:center">
      <span class="mini" style="letter-spacing:.12em;margin-right:4px">Etiqueta</span>
      ${TAGS.map((t, i) => `<button data-acc="tareaEtq" data-i="${t}" style="cursor:pointer;border:1px solid ${u.tareaEtq === t ? pal(i).bar : 'var(--borde)'};background:${u.tareaEtq === t ? pal(i).bg : 'var(--card)'};border-radius:999px;padding:6px 12px;font-size:11px;color:${u.tareaEtq === t ? '#5A5A60' : 'var(--txt-pill)'}">${t}</button>`).join('')}
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px;align-items:center">
      <span class="mini" style="letter-spacing:.12em;margin-right:4px">Filtrar</span>
      ${['Todas', ...TAGS].map(t => `<button data-acc="tareaFiltro" data-i="${t}" style="cursor:pointer;border:1px solid ${u.tareaFiltro === t ? '#3B3B3F' : 'var(--borde)'};background:${u.tareaFiltro === t ? '#3B3B3F' : 'var(--card)'};color:${u.tareaFiltro === t ? '#FFF' : 'var(--txt-pill)'};border-radius:999px;padding:6px 12px;font-size:11px">${t}</button>`).join('')}
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${vis.map(t => `<div class="tarea">
        <button class="check" data-tarea="${t.id}" style="${t.hecha ? 'border-color:#B4DCBC;background:#B4DCBC' : ''}">${t.hecha ? '✓' : ''}</button>
        <div style="flex:1;min-width:0;font-size:14px;${t.hecha ? 'color:var(--txt5);text-decoration:line-through' : ''}">${editable('tareas', t.id, 'texto', t.texto)}</div>
        <span class="etq" style="background:${pal(Math.max(0, TAGS.indexOf(t.etiqueta))).bg}">${esc(t.etiqueta)}</span>
        <button class="icono" data-borrar-tarea="${t.id}">×</button>
      </div>`).join('')}
    </div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* PROYECTOS                                                           */
/* ------------------------------------------------------------------ */
function plazo(f, hoy) {
  if (!f) return 'Sin fecha';
  const dif = Math.round((new Date(f + 'T00:00:00') - new Date(hoy + 'T00:00:00')) / 864e5);
  return dif === 0 ? 'Vence hoy' : dif < 0 ? 'Atrasado' : dif + ' días';
}

function vProyectos() {
  const u = estado.ui, d = D(), hoy = kf(u.ahora);
  const pasosDe = id => d.proyecto_pasos.filter(s => s.proyecto_id === id).sort((a, x) => a.orden - x.orden);

  if (!u.proyecto) {
    return `<div>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;flex-wrap:wrap">
        <div style="font-size:22px;font-weight:500;margin-right:auto">Proyectos</div>
        <input class="campo" style="width:240px;background:var(--card)" data-f="proy" data-b="proy" data-enter="addProyecto" placeholder="Nombre del proyecto" value="${esc(b('proy'))}">
        <button class="primario" data-acc="addProyecto">+ Crear</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px">
        ${d.proyectos.map(p => {
          const ps = pasosDe(p.id), hechos = ps.filter(s => s.hecho).length;
          const pct = ps.length ? Math.round(hechos * 100 / ps.length) : 0;
          return `<div class="pcard" data-proyecto="${p.id}">
            <div style="height:64px;background:${pal(p.color).bg};display:flex;align-items:flex-end;padding:12px 20px;gap:8px">
              <span style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;background:rgba(255,255,255,.6);border-radius:999px;padding:4px 10px;color:#5A5A60">${esc(p.etiqueta)}</span>
              <span style="margin-left:auto;font-size:11px;color:#5A5A60">${plazo(p.vence, hoy)}</span>
            </div>
            <div style="padding:18px 20px 20px;display:flex;flex-direction:column;gap:8px;flex:1">
              <div style="font-size:16px;font-weight:500">${esc(p.nombre)}</div>
              <div style="font-size:12px;line-height:1.5;color:var(--txt3);text-wrap:pretty">${esc(p.descripcion || 'Sin descripción todavía.')}</div>
              <div style="margin-top:auto;padding-top:14px">
                <div class="barra"><i style="width:${pct}%;background:${pal(p.color).bar}"></i></div>
                <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--txt4);margin-top:8px">
                  <span>${hechos} de ${ps.length} pasos</span><span>${pct}%</span>
                </div>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  const p = d.proyectos.find(x => x.id === u.proyecto);
  if (!p) { u.proyecto = null; return vProyectos(); }
  const ps = pasosDe(p.id), hechos = ps.filter(s => s.hecho).length;
  const pct = ps.length ? Math.round(hechos * 100 / ps.length) : 0;
  const notas = d.proyecto_notas.filter(n => n.proyecto_id === p.id);

  return `<div style="max-width:860px;margin:0 auto">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:22px;flex-wrap:wrap">
      <button class="pill" data-acc="cerrarProyecto">‹ Proyectos</button>
      <div style="font-size:22px;font-weight:500">${editable('proyectos', p.id, 'nombre', p.nombre)}</div>
      <button class="pill" style="margin-left:auto;color:var(--peligro)" data-acc="borrarProyecto">Eliminar</button>
    </div>
    <div class="tarjeta" style="overflow:hidden">
      <div class="pastel" style="background:${pal(p.color).bg};padding:26px;display:flex;gap:26px;align-items:center;flex-wrap:wrap">
        <div style="position:relative;width:104px;height:104px;border-radius:50%;flex:0 0 auto;background:conic-gradient(${pal(p.color).bar} ${pct}%, rgba(255,255,255,.65) 0)">
          <div style="position:absolute;inset:11px;border-radius:50%;background:#FFF;display:flex;flex-direction:column;align-items:center;justify-content:center">
            <div style="font-size:24px;font-weight:300">${pct}%</div>
            <div style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--txt4)">avance</div>
          </div>
        </div>
        <div style="flex:1;min-width:220px;display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            ${TAGS.map(t => `<button data-etq-proy="${t}" style="cursor:pointer;border:1px solid ${p.etiqueta === t ? '#FFF' : 'transparent'};background:${p.etiqueta === t ? '#FFF' : 'rgba(255,255,255,.45)'};border-radius:999px;padding:5px 12px;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#5A5A60">${t}</button>`).join('')}
            <input type="date" data-f="pv" data-vence="${p.id}" value="${p.vence || ''}" style="margin-left:auto;border:1px solid rgba(255,255,255,.8);background:rgba(255,255,255,.7);border-radius:999px;padding:6px 12px;font-size:11px">
          </div>
          <textarea data-f="pd" data-desc="${p.id}" placeholder="Describí el objetivo del proyecto…" style="width:100%;height:56px;border:1px solid rgba(255,255,255,.8);background:rgba(255,255,255,.6);border-radius:14px;padding:10px 12px;font-size:13px;line-height:1.5;color:#55555A">${esc(p.descripcion)}</textarea>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));border-bottom:1px solid var(--borde-suave)">
        ${[['Pasos hechos', hechos + '/' + ps.length], ['Pendientes', ps.length - hechos],
           ['Fecha límite', p.vence ? fechaCorta(p.vence) : '—'], ['Plazo', plazo(p.vence, hoy)]
        ].map(([k, v]) => `<div style="padding:18px 20px;border-right:1px solid var(--borde-suave)">
          <div style="font-size:22px;font-weight:300">${v}</div>
          <div class="mini" style="letter-spacing:.12em;margin-top:4px">${k}</div>
        </div>`).join('')}
      </div>

      <div style="padding:26px">
        <div class="mini" style="margin-bottom:18px">Pasos</div>
        ${ps.map((s, i) => `<div style="display:flex;gap:16px;align-items:flex-start">
          <div style="flex:0 0 auto;display:flex;flex-direction:column;align-items:center;align-self:stretch">
            <button class="check" data-paso="${s.id}" style="width:26px;height:26px;font-size:12px;${s.hecho ? `border-color:${pal(p.color).bar};background:${pal(p.color).bar}` : ''}">${s.hecho ? '✓' : ''}</button>
            <div style="flex:1;width:2px;min-height:22px;background:${s.hecho ? pal(p.color).bg : 'var(--borde-suave)'}"></div>
          </div>
          <div style="flex:1;padding-bottom:22px">
            <div style="font-size:15px;${s.hecho ? 'color:var(--txt4);text-decoration:line-through' : ''}">${editable('proyecto_pasos', s.id, 'texto', s.texto)}</div>
            <div style="font-size:11px;color:var(--txt5);margin-top:4px">Paso ${i + 1}${s.hecho ? ' · completado' : ''}</div>
          </div>
          <button class="icono" data-borrar-paso="${s.id}">×</button>
        </div>`).join('')}
        <div style="display:flex;gap:10px;margin-top:6px">
          <input class="campo" data-f="paso" data-b="paso" data-enter="addPaso" placeholder="Agregar paso…" value="${esc(b('paso'))}">
          <button class="primario" style="padding:0 22px" data-acc="addPaso">+</button>
        </div>
      </div>

      <div style="border-top:1px solid var(--borde-suave);padding:24px 26px">
        <div class="mini" style="margin-bottom:14px">Notas del proyecto</div>
        <div style="display:flex;gap:10px;margin-bottom:16px">
          <input class="campo" data-f="pnota" data-b="pnota" data-enter="addNotaProy" placeholder="Idea, pendiente, referencia…" value="${esc(b('pnota'))}">
          <button class="primario" style="padding:0 22px" data-acc="addNotaProy">+</button>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          ${notas.map(n => `<div style="position:relative;width:158px;min-height:104px;padding:12px 12px 24px;border-radius:3px;background:${pal(n.color).bg};box-shadow:0 5px 12px rgba(60,60,70,.10);font-family:Caveat,cursive;font-size:18px;line-height:1.3;color:#4A4A4E;text-wrap:pretty">${esc(n.texto)}
            <button class="icono" data-borrar-pnota="${n.id}" style="position:absolute;right:8px;bottom:4px;font-size:14px">×</button>
          </div>`).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* HÁBITOS                                                             */
/* ------------------------------------------------------------------ */
function vHabitos() {
  const d = D(), u = estado.ui, n = u.ahora, hoy = kf(n);
  const marcado = (h, k) => d.habito_marcas.some(m => m.habito_id === h.id && m.fecha === k);
  const hechosHoy = d.habitos.filter(h => marcado(h, hoy)).length;
  const porMes = u.modoHab === 'mes';
  const seg = `<div class="segmento">
    ${[['semana','Semana'],['mes','Mes']].map(([k, t]) => `<button class="${u.modoHab === k ? 'on' : ''}" data-acc="modoHab" data-i="${k}">${t}</button>`).join('')}
  </div>`;

  let titulo, esHoy, dias, ancho, gap;
  if (porMes) {
    if (!u.habitosMes) u.habitosMes = mesActual();
    const ym = u.habitosMes, y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1;
    titulo = mesTexto(ym);
    esHoy = ym === mesActual();
    dias = Array.from({ length: new Date(y, m + 1, 0).getDate() }, (_, i) => {
      const dd = new Date(y, m, i + 1);
      return { k: kf(dd), nom: DIAS[dd.getDay()].slice(0, 1), num: i + 1 };
    });
    ancho = 17; gap = 3;
  } else {
    if (!u.habitosSemana) u.habitosSemana = kf(lunesDe(n));
    const inicio = new Date(u.habitosSemana + 'T00:00:00');
    const fin = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 6);
    titulo = `${inicio.getDate()} ${MES3[inicio.getMonth()]} — ${fin.getDate()} ${MES3[fin.getMonth()]}`;
    esHoy = u.habitosSemana === kf(lunesDe(n));
    dias = Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
      return { k: kf(dd), nom: DIAS[dd.getDay()].slice(0, 3), num: dd.getDate() };
    });
    ancho = 34; gap = 8;
  }
  // En el mes, la última columna cuenta los días cumplidos sobre los días ya
  // transcurridos; en la semana, muestra la racha.
  const transcurridos = dias.filter(x => x.k <= hoy).length;
  const celdaMes = `width:${ancho}px;height:${ancho}px;border-radius:5px;font-size:9px`;

  return `<div style="max-width:${porMes ? 960 : 860}px;margin:0 auto">
    <div style="display:flex;align-items:baseline;gap:14px;margin-bottom:20px;flex-wrap:wrap">
      <div style="font-size:22px;font-weight:500">Hábitos</div>
      <div style="font-size:12px;color:var(--txt4)">${hechosHoy} de ${d.habitos.length} hechos hoy</div>
    </div>
    <div style="display:flex;gap:10px;margin-bottom:20px">
      <input class="campo" style="border-radius:16px;padding:14px 16px;background:var(--card)" data-f="hab" data-b="hab" data-enter="addHabito" placeholder="Nuevo hábito… (ej. leer 20 min)" value="${esc(b('hab'))}">
      <button class="primario" style="border-radius:16px;padding:0 24px" data-acc="addHabito">+</button>
    </div>
    <div class="tarjeta" style="padding:22px 24px;overflow-x:auto">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
        <div style="font-size:13px;color:var(--txt3)">${titulo}</div>
        <div style="display:flex;gap:8px;margin-left:auto;align-items:center">
          ${seg}
          ${esHoy ? '' : `<button class="pill" data-acc="habitosHoy">Hoy</button>`}
          <button class="redondo" data-acc="habitosSemana" data-i="-1">‹</button>
          <button class="redondo" data-acc="habitosSemana" data-i="1">›</button>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <div style="flex:1;min-width:120px"></div>
        <div style="flex:0 0 auto;display:flex;gap:${gap}px">
          ${dias.map(x => `<div style="width:${ancho}px;text-align:center">
            <div style="font-size:9px;letter-spacing:${porMes ? 0 : '.1em'};text-transform:uppercase;color:var(--txt5)">${x.nom}</div>
            <div style="font-size:${porMes ? 9 : 11}px;color:${x.k === hoy ? 'var(--sel-fg)' : 'var(--txt5)'};font-weight:${x.k === hoy ? 700 : 400};margin-top:2px">${x.num}</div>
          </div>`).join('')}
        </div>
        <div style="flex:0 0 54px;text-align:right;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--txt5)">${porMes ? 'Días' : 'Racha'}</div>
        <div style="flex:0 0 20px"></div>
      </div>
      ${d.habitos.length ? d.habitos.map(h => {
        let dato;
        if (porMes) {
          dato = `${dias.filter(x => marcado(h, x.k)).length}/${transcurridos}`;
        } else {
          // Si hoy todavía no está marcado, la racha sigue viva desde ayer.
          let racha = 0;
          for (let i = marcado(h, hoy) ? 0 : 1; i < 400; i++) {
            const dd = new Date(n.getFullYear(), n.getMonth(), n.getDate() - i);
            if (marcado(h, kf(dd))) racha++; else break;
          }
          dato = racha + 'd';
        }
        return `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--borde-fino)">
          <div style="flex:1;min-width:120px;display:flex;align-items:center;gap:10px">
            <span style="flex:0 0 auto;width:10px;height:10px;border-radius:50%;background:${pal(h.color).bar}"></span>
            <span style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${editable('habitos', h.id, 'nombre', h.nombre)}</span>
          </div>
          <div style="flex:0 0 auto;display:flex;gap:${gap}px">
            ${dias.map(x => { const on = marcado(h, x.k); return `<button class="celda" data-marca="${h.id}" data-fecha="${x.k}" title="${fechaCorta(x.k)}" style="${porMes ? celdaMes + ';padding:0;' : ''}${on ? `background:${pal(h.color).bg};border-color:${pal(h.color).bar};color:#7C7C82` : ''}">${on ? '✓' : ''}</button>`; }).join('')}
          </div>
          <div style="flex:0 0 54px;text-align:right;font-size:13px;color:var(--txt2)">${dato}</div>
          <button class="icono" data-borrar-habito="${h.id}" style="flex:0 0 20px;text-align:center">×</button>
        </div>`;
      }).join('') : '<div style="padding:18px 2px;font-size:13px;color:var(--txt4)">Todavía no hay hábitos. Agregá el primero arriba.</div>'}
    </div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* DINERO                                                              */
/* ------------------------------------------------------------------ */
function vDinero() {
  const d = D(), u = estado.ui, mes = mesDinero(), esActual = mes === mesActual();
  const nombreMes = MESES[+mes.slice(5, 7) - 1].toLowerCase();
  const mensual = d.dinero_mensual.find(x => x.mes === mes) || {};
  const base = num(mensual.dinero_base), meta = num(mensual.meta_ahorro);
  const delMes = l => l.filter(x => String(x.fecha).slice(0, 7) === mes);
  const suma = l => l.reduce((a, x) => a + num(x.monto), 0);
  const vars = delMes(d.gastos_variables), ings = delMes(d.ingresos), ahorros = delMes(d.ahorros);
  const fijos = d.gastos_fijos.filter(g => mesFijo(g) === mes);
  const fijosAnt = d.gastos_fijos.filter(g => mesFijo(g) === correrMes(mes, -1));
  const sF = suma(fijos), sV = suma(vars), sI = suma(ings), sA = suma(ahorros);
  const gastos = sF + sV, entra = base + sI, disp = entra - gastos - sA;
  const pctG = entra > 0 ? Math.min(100, Math.round(gastos * 100 / entra)) : 0;
  const pctA = meta > 0 ? Math.min(100, Math.round(sA * 100 / meta)) : 0;
  const pagado = g => d.gastos_fijos_pagos.some(p => p.gasto_id === g.id && p.mes === mes);
  const cols = innerWidth < 900 ? '1fr' : innerWidth < 1180 ? 'repeat(2,minmax(0,1fr))' : 'repeat(3,minmax(0,1fr))';

  return `<div style="display:flex;flex-direction:column;gap:20px">
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <div style="font-size:22px;font-weight:500;margin-right:auto">${mesTexto(mes)}</div>
      ${esActual ? '' : `<button class="pill" data-acc="mesDineroHoy">Este mes</button>`}
      <button class="redondo" data-acc="mesDinero" data-i="-1" title="Mes anterior">‹</button>
      <button class="redondo" data-acc="mesDinero" data-i="1" title="Mes siguiente">›</button>
    </div>
    ${d.faltan?.includes('dinero_mensual') ? `<div class="tarjeta pastel" style="padding:14px 18px;background:#FBE2CE;font-size:13px">Falta correr el bloque nuevo de <b>esquema.sql</b> en Supabase: hasta entonces el dinero base, la meta y los gastos fijos no se pueden guardar por mes.</div>` : ''}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:16px">
      <div class="tarjeta" style="padding:22px">
        <div class="mini">Dinero base</div>
        <div style="display:flex;align-items:baseline;gap:4px;margin-top:8px">
          <span style="font-size:17px;color:var(--txt5)">$</span>
          <input data-f="base" data-mensual="dinero_base" value="${base ? base.toLocaleString('es-AR') : ''}" placeholder="0" style="width:100%;border:none;background:transparent;font-size:28px;font-weight:300;padding:0">
        </div>
        <div style="font-size:11px;color:var(--txt5);margin-top:6px">Con lo que arrancás el mes</div>
      </div>
      <div class="tarjeta pastel" style="padding:22px;background:${disp < 0 ? '#FADDE1' : '#D8E8F7'}">
        <div class="mini" style="color:var(--txt2)">Disponible</div>
        <div style="font-size:28px;font-weight:300;margin-top:8px">${money(disp)}</div>
        <div style="font-size:11px;color:var(--txt2);margin-top:6px">${disp < 0 ? 'Estás gastando de más' : 'Después de gastos y ahorro'}</div>
      </div>
      <div class="tarjeta" style="padding:22px">
        <div class="mini">Gastado en ${nombreMes}</div>
        <div style="font-size:28px;font-weight:300;margin-top:8px">${money(gastos)}</div>
        <div class="barra" style="margin-top:12px"><i style="width:${pctG}%;background:#EFBCC4"></i></div>
        <div style="font-size:11px;color:var(--txt5);margin-top:7px">${entra > 0 ? pctG + '% de lo que entró' : 'Cargá tu dinero base'}</div>
      </div>
      <div class="tarjeta" style="padding:22px">
        <div class="mini">Ahorrado en ${nombreMes}</div>
        <div style="font-size:28px;font-weight:300;margin-top:8px">${money(sA)}</div>
        <div class="barra" style="margin-top:12px"><i style="width:${pctA}%;background:#B4DCBC"></i></div>
        <div style="font-size:11px;color:var(--txt5);margin-top:7px">${meta > 0 ? 'Meta ' + money(meta) : 'Definí una meta abajo'}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:${cols};gap:20px;align-items:start">
      <div class="tarjeta" style="padding:24px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <div class="rotulo" style="margin-right:auto">Gastos fijos vitales</div>
          <div style="font-size:13px;color:var(--txt2)">${money(sF)}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
          ${fijos.length ? fijos.map(g => { const pg = pagado(g); return `
            <div class="pastel" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:${pal(g.color).bg}">
              <button class="check" data-pago="${g.id}" style="width:20px;height:20px;font-size:10px;${pg ? `border-color:${pal(g.color).bar};background:${pal(g.color).bar}` : 'border-color:rgba(0,0,0,.12);background:transparent'}">${pg ? '✓' : ''}</button>
              <div style="flex:1;min-width:0">
                <div style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${pg ? 'color:#8A8A90' : ''}">${editable('gastos_fijos', g.id, 'nombre', g.nombre)}</div>
                <div style="font-size:11px;color:var(--txt2);margin-top:2px">${pg ? 'Pagado' : 'Pendiente'}</div>
              </div>
              <div style="font-size:14px;font-weight:500">${editable('gastos_fijos', g.id, 'monto', g.monto)}</div>
              <button class="icono" data-borrar-fijo="${g.id}">×</button>
            </div>`; }).join('') : `<div style="padding:14px 2px;font-size:13px;color:var(--txt4)">Alquiler, luz, internet… lo que se repite todos los meses.</div>
            ${fijosAnt.length ? `<button class="pill" data-acc="copiarFijos" style="align-self:flex-start">Copiar los ${fijosAnt.length} de ${MESES[+correrMes(mes, -1).slice(5, 7) - 1].toLowerCase()}</button>` : ''}`}
        </div>
        <div style="display:flex;gap:8px">
          <input class="campo" data-f="fN" data-b="fN" data-enter="addFijo" placeholder="Concepto" value="${esc(b('fN'))}">
          <input class="campo" style="flex:0 0 94px" data-f="fM" data-b="fM" data-enter="addFijo" placeholder="$" value="${esc(b('fM'))}">
          <button class="primario" style="padding:0 18px" data-acc="addFijo">+</button>
        </div>
      </div>

      <div class="tarjeta" style="padding:24px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <div class="rotulo" style="margin-right:auto">Gastos variables</div>
          <div style="font-size:13px;color:var(--txt2)">${money(sV)}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          ${CATS.map((c, i) => `<button data-acc="varCat" data-i="${c}" style="cursor:pointer;border:1px solid ${u.varCat === c ? pal(i).bar : 'var(--borde)'};background:${u.varCat === c ? pal(i).bg : 'var(--card)'};border-radius:999px;padding:6px 12px;font-size:11px;color:${u.varCat === c ? '#5A5A60' : 'var(--txt-pill)'}">${c}</button>`).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <input class="campo" data-f="vN" data-b="vN" data-enter="addVar" placeholder="¿En qué gastaste?" value="${esc(b('vN'))}">
          <input class="campo" style="flex:0 0 94px" data-f="vM" data-b="vM" data-enter="addVar" placeholder="$" value="${esc(b('vM'))}">
          <button class="primario" style="padding:0 18px" data-acc="addVar">+</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto">
          ${vars.length ? vars.map(g => `<div style="display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:14px;border:1px solid var(--borde-fino)">
            <span style="flex:0 0 auto;width:9px;height:9px;border-radius:50%;background:${pal(Math.max(0, CATS.indexOf(g.categoria))).bar}"></span>
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${editable('gastos_variables', g.id, 'nombre', g.nombre)}</div>
              <div style="font-size:11px;color:var(--txt4);margin-top:2px">${esc(g.categoria)} · ${fechaCorta(g.fecha)}</div>
            </div>
            <div style="font-size:14px;font-weight:500">${editable('gastos_variables', g.id, 'monto', g.monto)}</div>
            <button class="icono" data-borrar-var="${g.id}">×</button>
          </div>`).join('') : `<div style="padding:14px 2px;font-size:13px;color:var(--txt4)">Todavía no registraste gastos en ${nombreMes}.</div>`}
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:20px">
        <div class="tarjeta" style="padding:24px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
            <div class="rotulo" style="margin-right:auto">Otros ingresos</div>
            <div style="font-size:13px;color:var(--txt2)">${money(sI)}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
            ${ings.length ? ings.map(i => `<div class="pastel" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:#DCEFDF">
              <div style="flex:1;min-width:0">
                <div style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${editable('ingresos', i.id, 'origen', i.origen)}</div>
                <div style="font-size:11px;color:var(--txt2);margin-top:2px">${i.detalle ? esc(i.detalle) + ' · ' : ''}${fechaCorta(i.fecha)}</div>
              </div>
              <div style="font-size:14px;font-weight:500">${editable('ingresos', i.id, 'monto', i.monto)}</div>
              <button class="icono" data-borrar-ing="${i.id}">×</button>
            </div>`).join('') : '<div style="padding:14px 2px;font-size:13px;color:var(--txt4)">Trabajos extra, ventas, regalos.</div>'}
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <input class="campo" data-f="iO" data-b="iO" data-enter="addIngreso" placeholder="¿De dónde viene?" value="${esc(b('iO'))}">
            <div style="display:flex;gap:8px">
              <input class="campo" data-f="iD" data-b="iD" data-enter="addIngreso" placeholder="Detalle (opcional)" value="${esc(b('iD'))}">
              <input class="campo" style="flex:0 0 94px" data-f="iM" data-b="iM" data-enter="addIngreso" placeholder="$" value="${esc(b('iM'))}">
              <button class="primario" style="padding:0 18px" data-acc="addIngreso">+</button>
            </div>
          </div>
        </div>

        <div class="tarjeta" style="padding:24px">
          <div class="rotulo" style="margin-bottom:18px">Ahorro</div>
          <div style="display:flex;align-items:center;gap:20px;margin-bottom:18px">
            <div style="position:relative;width:92px;height:92px;border-radius:50%;flex:0 0 auto;background:conic-gradient(#B4DCBC ${pctA}%, var(--borde-suave) 0)">
              <div style="position:absolute;inset:10px;border-radius:50%;background:var(--card);display:flex;flex-direction:column;align-items:center;justify-content:center">
                <div style="font-size:19px;font-weight:300">${pctA}%</div>
                <div style="font-size:8px;letter-spacing:.06em;text-transform:uppercase;color:var(--txt4)">meta</div>
              </div>
            </div>
            <div style="flex:1;min-width:0">
              <div class="mini" style="margin-bottom:6px">Meta de ahorro</div>
              <div style="display:flex;align-items:baseline;gap:4px">
                <span style="font-size:15px;color:var(--txt5)">$</span>
                <input data-f="meta" data-mensual="meta_ahorro" value="${meta ? meta.toLocaleString('es-AR') : ''}" placeholder="0" style="width:100%;border:none;background:transparent;font-size:22px;font-weight:300;padding:0">
              </div>
              <div style="font-size:11px;color:var(--txt5);margin-top:4px">${meta > 0 ? (sA >= meta ? 'Meta cumplida' : 'Faltan ' + money(meta - sA)) : 'Sin meta definida'}</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-bottom:14px">
            <input class="campo" data-f="aN" data-b="aN" data-enter="addAhorro" placeholder="Concepto" value="${esc(b('aN'))}">
            <input class="campo" style="flex:0 0 94px" data-f="aM" data-b="aM" data-enter="addAhorro" placeholder="$" value="${esc(b('aM'))}">
            <button class="primario" style="padding:0 18px" data-acc="addAhorro">+</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:200px;overflow-y:auto">
            ${ahorros.map(a => `<div class="pastel" style="display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:14px;background:#F7FAF8">
              <div style="flex:1;min-width:0">
                <div style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${editable('ahorros', a.id, 'nombre', a.nombre)}</div>
                <div style="font-size:11px;color:var(--txt4);margin-top:2px">${fechaCorta(a.fecha)}</div>
              </div>
              <div style="font-size:14px;font-weight:500">${editable('ahorros', a.id, 'monto', a.monto)}</div>
              <button class="icono" data-borrar-ahorro="${a.id}">×</button>
            </div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* NOTAS DE TEXTO (tabla "apuntes")                                    */
/* ------------------------------------------------------------------ */
// Como en la app de notas del celular: la primera línea es el título y
// lo que sigue se ve como adelanto en la lista.
const lineasApunte = a => String(a.texto || '').split('\n').map(l => l.trim()).filter(Boolean);
const tituloApunte = a => (lineasApunte(a)[0] || 'Nota nueva').slice(0, 80);
const adelantoApunte = a => lineasApunte(a).slice(1).join(' ').slice(0, 90);
function fechaApunte(a) {
  const d = new Date(a.actualizado_en || a.creado_en);
  if (isNaN(d)) return '';
  if (kf(d) === kf(estado.ui.ahora)) return pad(d.getHours()) + ':' + pad(d.getMinutes());
  return d.getDate() + ' ' + MES3[d.getMonth()] + (d.getFullYear() !== estado.ui.ahora.getFullYear() ? ' ' + d.getFullYear() : '');
}
// Una nota que se deja vacía se descarta sola, como en el celular.
function descartarApunteVacio(salvo) {
  const a = D().apuntes.find(x => x.id === estado.ui.apunte);
  if (!a || a.id === salvo || String(a.texto || '').trim()) return;
  quitar('apuntes', a.id);
  seguro(() => db.borrar('apuntes', a.id));
}
function itemApunte(a, sel) {
  return `<button data-apunte="${a.id}" style="width:100%;text-align:left;border:none;cursor:pointer;border-radius:14px;padding:12px 14px;background:${sel ? 'var(--sel-bg)' : 'transparent'};color:var(--txt)">
    <span data-titulo style="display:block;font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(tituloApunte(a))}</span>
    <span style="display:flex;gap:8px;font-size:12px;color:var(--txt4);margin-top:3px">
      <span style="flex:0 0 auto">${fechaApunte(a)}</span>
      <span data-adelanto style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(adelantoApunte(a)) || 'Sin más texto'}</span>
    </span>
  </button>`;
}

function vApuntes() {
  const d = D(), u = estado.ui;
  if (d.faltan?.includes('apuntes')) {
    return `<div class="tarjeta pastel" style="max-width:760px;margin:0 auto;padding:18px 22px;background:#FBE2CE;font-size:13px;line-height:1.5">Para usar las notas de texto falta correr el <b>esquema.sql</b> actualizado en Supabase (SQL Editor → Run). Es seguro correrlo de nuevo: no borra nada.</div>`;
  }
  const lista = [...d.apuntes].sort((a, x) => String(x.actualizado_en).localeCompare(String(a.actualizado_en)));
  const sel = d.apuntes.find(a => a.id === u.apunte);
  if (!sel) u.apunte = null;
  const angosto = innerWidth < 900;

  const columnaLista = `<section class="tarjeta" style="flex:0 0 ${angosto ? 'auto' : '300px'};padding:16px;display:flex;flex-direction:column;gap:12px;max-height:${angosto ? 'none' : '76vh'}">
    <div style="display:flex;align-items:center;gap:10px;padding:4px 6px 0">
      <div style="font-size:22px;font-weight:500;margin-right:auto">Notas</div>
      <button class="primario" style="border-radius:999px;padding:8px 16px;font-size:13px" data-acc="nuevoApunte">+ Nueva</button>
    </div>
    <div style="font-size:12px;color:var(--txt4);padding:0 6px">${lista.length} ${lista.length === 1 ? 'nota' : 'notas'}</div>
    <div style="display:flex;flex-direction:column;gap:2px;overflow-y:auto">
      ${lista.length ? lista.map(a => itemApunte(a, a.id === u.apunte)).join('') : '<div style="padding:14px 6px;font-size:13px;color:var(--txt4);line-height:1.5">Todavía no hay notas. Tocá "+ Nueva" para escribir la primera.</div>'}
    </div>
  </section>`;

  const editor = sel ? `<section class="tarjeta" style="flex:1;min-width:0;padding:22px 26px;display:flex;flex-direction:column;gap:10px">
    <div style="display:flex;align-items:center;gap:10px">
      ${angosto ? `<button class="pill" data-acc="cerrarApunte">‹ Notas</button>` : ''}
      <div style="font-size:12px;color:var(--txt4);margin-right:auto">${fechaApunte(sel) ? 'Editada ' + (kf(new Date(sel.actualizado_en || sel.creado_en)) === kf(u.ahora) ? 'hoy a las ' : 'el ') + fechaApunte(sel) : ''}</div>
      <button class="pill" style="color:var(--peligro)" data-acc="borrarApunte">Eliminar</button>
    </div>
    <textarea data-f="apunte-${sel.id}" data-apunte-texto="${sel.id}" placeholder="Escribí tu nota… La primera línea es el título." style="flex:1;width:100%;min-height:60vh;border:none;outline:none;background:transparent;font-size:15px;line-height:1.65;color:var(--txt)">${esc(sel.texto)}</textarea>
  </section>` : `<section class="tarjeta" style="flex:1;min-width:0;padding:22px;display:flex;align-items:center;justify-content:center;min-height:40vh;color:var(--txt4);font-size:13px">Elegí una nota de la lista o creá una nueva.</section>`;

  if (angosto) return `<div>${sel ? editor : columnaLista}</div>`;
  return `<div style="display:flex;gap:20px;align-items:stretch">${columnaLista}${editor}</div>`;
}

/* ------------------------------------------------------------------ */
/* acciones                                                            */
/* ------------------------------------------------------------------ */
const CAMPOS_DINERO = ['fN', 'fM', 'vN', 'vM', 'iO', 'iD', 'iM', 'aN', 'aM'];
const quitar = (t, id) => { D()[t] = D()[t].filter(x => x.id !== id); };

const ACCIONES = {
  notaColor: i => { estado.ui.notaColor = +i; },
  notaFuente: i => { estado.ui.notaFuente = +i; },
  evColor: i => { estado.ui.evColor = +i; },
  varCat: i => { estado.ui.varCat = i; },
  tareaEtq: i => { estado.ui.tareaEtq = i; },
  tareaFiltro: i => { estado.ui.tareaFiltro = i; },
  modoCal: i => { estado.ui.modoCal = i; },
  cerrarDia: () => { estado.ui.selDia = null; },
  cerrarProyecto: () => { estado.ui.proyecto = null; },
  mes: i => {
    const c = estado.ui.cursor, m = c.m + (+i);
    estado.ui.cursor = { y: c.y + Math.floor(m / 12), m: (m % 12 + 12) % 12 };
  },
  mesHoy: () => { const n = estado.ui.ahora; estado.ui.cursor = { y: n.getFullYear(), m: n.getMonth() }; },
  semana: i => {
    const w = new Date(estado.ui.semana + 'T00:00:00');
    estado.ui.semana = kf(new Date(w.getFullYear(), w.getMonth(), w.getDate() + (+i) * 7));
  },
  modoHab: i => { estado.ui.modoHab = i; },
  nuevoApunte: () => seguro(async () => {
    descartarApunteVacio();
    const a = await db.crear('apuntes', { texto: '', actualizado_en: new Date().toISOString() });
    D().apuntes.unshift(a);
    estado.ui.apunte = a.id;
    // Se deja el cursor listo para escribir.
    setTimeout(() => $('[data-apunte-texto]')?.focus());
  }),
  cerrarApunte: () => { descartarApunteVacio(); estado.ui.apunte = null; },
  borrarApunte: () => seguro(async () => {
    const id = estado.ui.apunte;
    const a = D().apuntes.find(x => x.id === id);
    if (!a) return;
    if (String(a.texto || '').trim() && !confirm('¿Eliminar la nota "' + tituloApunte(a) + '"? No se puede deshacer.')) return;
    quitar('apuntes', id);
    estado.ui.apunte = null;
    await db.borrar('apuntes', id);
  }),
  habitosSemana: i => {
    if (estado.ui.modoHab === 'mes') { estado.ui.habitosMes = correrMes(estado.ui.habitosMes || mesActual(), +i); return; }
    const w = new Date(estado.ui.habitosSemana + 'T00:00:00');
    estado.ui.habitosSemana = kf(new Date(w.getFullYear(), w.getMonth(), w.getDate() + (+i) * 7));
  },
  habitosHoy: () => { estado.ui.habitosSemana = kf(lunesDe(estado.ui.ahora)); estado.ui.habitosMes = mesActual(); },
  salir: async () => { await db.salir(); },
  exportar: () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(D(), null, 2)], { type: 'application/json' }));
    a.download = 'oggi-respaldo.json';
    a.click();
  },
  panelRecordatorios: () => { estado.ui.panelRecordatorios = !estado.ui.panelRecordatorios; estado.ui.panelCuenta = false; },
  panelCuenta: () => { estado.ui.panelCuenta = !estado.ui.panelCuenta; estado.ui.panelRecordatorios = false; },
  tema: () => {
    const t = estado.ui.tema === 'noche' ? 'dia' : 'noche';
    estado.ui.tema = t;
    localStorage.setItem('oggi-tema', t);
    aplicarTema(t);
  },
  borrarTodo: () => seguro(async () => {
    if (!confirm('Esto borra TODAS tus notas, eventos, tareas, proyectos, hábitos y datos de dinero. No se puede deshacer.\n\n¿Seguro que querés continuar?')) return;
    if (!confirm('Última confirmación: se va a borrar todo, salvo tu cuenta (correo y contraseña). ¿Borrar todo?')) return;
    estado.ui.panelCuenta = false;
    await db.borrarTodoMisDatos();
    await cargar();
    aviso('Tus datos fueron borrados.');
  }),
  borrarCuenta: () => seguro(async () => {
    if (!confirm('Esto elimina tu cuenta de OGGI para siempre: tu correo, tu contraseña y todos tus datos (notas, eventos, tareas, proyectos, hábitos y dinero). No se puede deshacer.\n\n¿Eliminar tu cuenta?')) return;
    if (!confirm('Última confirmación: no vas a poder volver a entrar con este correo. ¿Eliminar la cuenta definitivamente?')) return;
    estado.ui.panelCuenta = false;
    await db.borrarCuenta();
    try { await db.salir(); } catch (e) {}
    estado.datos = null;
    mostrarAcceso();
    aviso('Tu cuenta fue eliminada.');
  }),

  nuevaNota: () => seguro(async () => {
    const n = await db.crear('notas', { texto: '', color: estado.ui.notaColor, fuente: estado.ui.notaFuente, z: 1 });
    D().notas.push(n);
  }),
  alinear: () => seguro(async () => {
    await Promise.all(D().notas.map(n => db.actualizar('notas', n.id, { x: null, y: null, z: 1 })));
    D().notas.forEach(n => { n.x = null; n.y = null; n.z = 1; });
  }),

  addEvento: () => seguro(async () => {
    const t = b('evT').trim(); if (!t) return;
    const fecha = b('evF') || kf(estado.ui.ahora);
    const hora = b('evH') ? parseInt(b('evH').slice(0, 2), 10) : null;
    const e = await db.crear('eventos', { titulo: t, fecha, hora, color: estado.ui.evColor });
    D().eventos.push(e);
    limpiar('evT', 'evH');
    estado.ui.cursor = { y: +fecha.slice(0, 4), m: +fecha.slice(5, 7) - 1 };
  }),

  addTarea: () => seguro(async () => {
    const t = b('tarea').trim(); if (!t) return;
    const x = await db.crear('tareas', { texto: t, etiqueta: estado.ui.tareaEtq });
    D().tareas.unshift(x); limpiar('tarea');
  }),
  limpiarTareas: () => seguro(async () => {
    const ids = D().tareas.filter(t => t.hecha).map(t => t.id);
    await Promise.all(ids.map(id => db.borrar('tareas', id)));
    D().tareas = D().tareas.filter(t => !t.hecha);
  }),

  addProyecto: () => seguro(async () => {
    const n = b('proy').trim(); if (!n) return;
    const p = await db.crear('proyectos', { nombre: n, color: D().proyectos.length % 6 });
    D().proyectos.push(p); limpiar('proy');
  }),
  borrarProyecto: () => seguro(async () => {
    const id = estado.ui.proyecto;
    await db.borrar('proyectos', id);
    quitar('proyectos', id);
    D().proyecto_pasos = D().proyecto_pasos.filter(s => s.proyecto_id !== id);
    D().proyecto_notas = D().proyecto_notas.filter(s => s.proyecto_id !== id);
    estado.ui.proyecto = null;
  }),
  addPaso: () => seguro(async () => {
    const t = b('paso').trim(); if (!t || !estado.ui.proyecto) return;
    const orden = D().proyecto_pasos.filter(s => s.proyecto_id === estado.ui.proyecto).length;
    const s = await db.crear('proyecto_pasos', { proyecto_id: estado.ui.proyecto, texto: t, orden });
    D().proyecto_pasos.push(s); limpiar('paso');
  }),
  addNotaProy: () => seguro(async () => {
    const t = b('pnota').trim(); if (!t || !estado.ui.proyecto) return;
    const c = (D().proyecto_notas.filter(n => n.proyecto_id === estado.ui.proyecto).length + 1) % 6;
    const n = await db.crear('proyecto_notas', { proyecto_id: estado.ui.proyecto, texto: t, color: c });
    D().proyecto_notas.push(n); limpiar('pnota');
  }),

  addHabito: () => seguro(async () => {
    const t = b('hab').trim(); if (!t) return;
    const h = await db.crear('habitos', { nombre: t, color: D().habitos.length % 6 });
    D().habitos.push(h); limpiar('hab');
  }),

  // Al cambiar de mes se vacían los campos a medio escribir, para que nada
  // tipeado en un mes aparezca en otro.
  mesDinero: i => { estado.ui.mesDinero = correrMes(mesDinero(), +i); limpiar(...CAMPOS_DINERO); },
  mesDineroHoy: () => { estado.ui.mesDinero = null; limpiar(...CAMPOS_DINERO); },
  copiarFijos: () => seguro(async () => {
    const mes = mesDinero(), ant = correrMes(mes, -1);
    if (D().gastos_fijos.some(g => mesFijo(g) === mes)) return;
    for (const g of D().gastos_fijos.filter(g => mesFijo(g) === ant)) {
      D().gastos_fijos.push(await db.crear('gastos_fijos', { nombre: g.nombre, monto: num(g.monto), color: g.color, mes }));
    }
  }),
  addFijo: () => seguro(async () => {
    const n = b('fN').trim(); if (!n) return;
    const mes = mesDinero();
    const g = await db.crear('gastos_fijos', { nombre: n, monto: num(b('fM')), color: D().gastos_fijos.filter(x => mesFijo(x) === mes).length % 6, mes });
    D().gastos_fijos.push(g); limpiar('fN', 'fM');
  }),
  addVar: () => seguro(async () => {
    const n = b('vN').trim(); if (!n) return;
    const g = await db.crear('gastos_variables', { nombre: n, monto: num(b('vM')), categoria: estado.ui.varCat, fecha: fechaParaMes(mesDinero()) });
    D().gastos_variables.unshift(g); limpiar('vN', 'vM');
  }),
  addIngreso: () => seguro(async () => {
    const n = b('iO').trim(); if (!n) return;
    const i = await db.crear('ingresos', { origen: n, detalle: b('iD').trim(), monto: num(b('iM')), fecha: fechaParaMes(mesDinero()) });
    D().ingresos.unshift(i); limpiar('iO', 'iD', 'iM');
  }),
  addAhorro: () => seguro(async () => {
    if (!num(b('aM'))) return;
    const a = await db.crear('ahorros', { nombre: b('aN').trim() || 'Aporte', monto: num(b('aM')), fecha: fechaParaMes(mesDinero()) });
    D().ahorros.unshift(a); limpiar('aN', 'aM');
  })
};

/* ---------- marcas de sí/no (hábitos, pagos del mes) ----------
   La marca aparece al instante; mientras se guarda se ignoran los clics
   sobre ella, así un doble clic no intenta crearla dos veces. */
function alternar(tabla, existente, nueva) {
  if (existente?.pendiente) return;
  if (existente) {
    D()[tabla] = D()[tabla].filter(x => x !== existente);
    render();
    return seguro(() => db.borrar(tabla, existente.id));
  }
  const tmp = { ...nueva, id: 'tmp-' + crypto.randomUUID(), pendiente: true };
  D()[tabla].push(tmp);
  render();
  return seguro(async () => {
    try { const fila = await db.crear(tabla, nueva); delete tmp.pendiente; Object.assign(tmp, fila); }
    catch (e) { D()[tabla] = D()[tabla].filter(x => x !== tmp); throw e; }
    finally { render(); }
  });
}

/* ---------- delegación de eventos ---------- */
document.addEventListener('click', async ev => {
  const el = ev.target.closest('[data-apunte],[data-editar],[data-acc],[data-tab],[data-ir],[data-dia],[data-proyecto],[data-tarea],[data-paso],[data-marca],[data-pago],[data-etq-proy],[data-notacolor],[data-paleta],[data-fuente],[data-modo-dibujo],[data-borrar-dibujo],[data-borrar-nota],[data-borrar-ev],[data-borrar-tarea],[data-borrar-paso],[data-borrar-pnota],[data-borrar-habito],[data-borrar-fijo],[data-borrar-var],[data-borrar-ing],[data-borrar-ahorro]');
  if (!el || !estado.datos) return;
  const s = el.dataset;

  if (s.apunte) {
    descartarApunteVacio(s.apunte);
    estado.ui.apunte = s.apunte;
    return render();
  }
  if (s.editar) {
    const [tabla, id, campo] = s.editar.split('|');
    estado.ui.editando = { tabla, id, campo };
    render();
    const i = $('[data-edicion]');
    if (i) { i.focus(); i.select(); }
    return;
  }

  // Caso especial: no re-renderizamos acá, para no perder la referencia
  // al <input type="file"> justo cuando se abre el selector del sistema.
  if (s.acc === 'importarClick') { $('#importFile')?.click(); return; }
  if (s.acc) { await ACCIONES[s.acc]?.(s.i); return render(); }
  if (s.tab) { if (s.tab !== 'apuntes') descartarApunteVacio(); Object.assign(estado.ui, { pestana: s.tab, selDia: null, proyecto: null, q: '', editando: null, panelRecordatorios: false, panelCuenta: false }); return render(); }
  if (s.ir) { Object.assign(estado.ui, JSON.parse(s.ir), { q: '', panelRecordatorios: false, panelCuenta: false }); return render(); }
  if (s.dia) { estado.ui.selDia = s.dia; return render(); }
  if (s.proyecto) { estado.ui.proyecto = s.proyecto; return render(); }

  if (s.tarea) { const t = D().tareas.find(x => x.id === s.tarea); t.hecha = !t.hecha; render(); return seguro(() => db.actualizar('tareas', t.id, { hecha: t.hecha })); }
  if (s.paso)  { const p = D().proyecto_pasos.find(x => x.id === s.paso); p.hecho = !p.hecho; render(); return seguro(() => db.actualizar('proyecto_pasos', p.id, { hecho: p.hecho })); }
  if (s.etqProy) { const p = D().proyectos.find(x => x.id === estado.ui.proyecto); p.etiqueta = s.etqProy; render(); return seguro(() => db.actualizar('proyectos', p.id, { etiqueta: s.etqProy })); }

  if (s.marca) {
    const m = D().habito_marcas.find(x => x.habito_id === s.marca && x.fecha === s.fecha);
    return alternar('habito_marcas', m, { habito_id: s.marca, fecha: s.fecha });
  }
  if (s.pago) {
    const mes = mesDinero();
    const p = D().gastos_fijos_pagos.find(x => x.gasto_id === s.pago && x.mes === mes);
    return alternar('gastos_fijos_pagos', p, { gasto_id: s.pago, mes });
  }

  if (s.paleta) { estado.ui.paletaNota = estado.ui.paletaNota === s.paleta ? null : s.paleta; return render(); }
  if (s.notacolor) { const n = D().notas.find(x => x.id === s.notacolor); n.color = +s.i; estado.ui.paletaNota = null; render(); return seguro(() => db.actualizar('notas', n.id, { color: n.color })); }
  if (s.fuente)    { const n = D().notas.find(x => x.id === s.fuente); n.fuente = ((n.fuente | 0) + 1) % FUENTES.length; render(); return seguro(() => db.actualizar('notas', n.id, { fuente: n.fuente })); }
  if (s.modoDibujo){ estado.ui.dibujo = estado.ui.dibujo === s.modoDibujo ? null : s.modoDibujo; return render(); }
  if (s.borrarDibujo) { const n = D().notas.find(x => x.id === s.borrarDibujo); n.trazos = []; render(); return seguro(() => db.actualizar('notas', n.id, { trazos: [] })); }

  const borrados = {
    borrarNota: 'notas', borrarEv: 'eventos', borrarTarea: 'tareas', borrarPaso: 'proyecto_pasos',
    borrarPnota: 'proyecto_notas', borrarHabito: 'habitos', borrarFijo: 'gastos_fijos',
    borrarVar: 'gastos_variables', borrarIng: 'ingresos', borrarAhorro: 'ahorros'
  };
  for (const [k, tabla] of Object.entries(borrados)) {
    if (s[k]) { const id = s[k]; quitar(tabla, id); render(); return seguro(() => db.borrar(tabla, id)); }
  }
});

/* ---------- escritura ---------- */
document.addEventListener('input', ev => {
  const s = ev.target.dataset;
  if (!s || !estado.datos) return;
  if (s.f === 'q') { estado.ui.q = ev.target.value; return render(); }
  if (s.b) { b(s.b, ev.target.value); return; }

  if (s.texto) {
    const n = D().notas.find(x => x.id === s.texto);
    n.texto = ev.target.value;
    return db.guardarConRetardo('n' + n.id, () => seguro(() => db.actualizar('notas', n.id, { texto: n.texto })));
  }
  if (s.apunteTexto) {
    const a = D().apuntes.find(x => x.id === s.apunteTexto);
    a.texto = ev.target.value;
    a.actualizado_en = new Date().toISOString();
    const item = $(`[data-apunte="${a.id}"]`);
    if (item) {
      item.querySelector('[data-titulo]').textContent = tituloApunte(a);
      item.querySelector('[data-adelanto]').textContent = adelantoApunte(a) || 'Sin más texto';
    }
    return db.guardarConRetardo('a' + a.id, () => seguro(() => db.actualizar('apuntes', a.id, { texto: a.texto, actualizado_en: a.actualizado_en })));
  }
  if (s.desc) {
    const p = D().proyectos.find(x => x.id === s.desc);
    p.descripcion = ev.target.value;
    return db.guardarConRetardo('p' + p.id, () => seguro(() => db.actualizar('proyectos', p.id, { descripcion: p.descripcion })));
  }
  if (s.vence) {
    const p = D().proyectos.find(x => x.id === s.vence);
    p.vence = ev.target.value || null;
    render();
    return seguro(() => db.actualizar('proyectos', p.id, { vence: p.vence }));
  }
  if (s.mensual) {
    const mes = mesDinero(), campo = s.mensual, valor = num(ev.target.value);
    let fila = D().dinero_mensual.find(x => x.mes === mes);
    if (!fila) { fila = { mes, dinero_base: 0, meta_ahorro: 0 }; D().dinero_mensual.push(fila); }
    fila[campo] = valor;
    return db.guardarConRetardo('mensual' + mes + campo, () => seguro(async () => {
      // Solo se toma el id: lo tipeado mientras tanto no se pisa.
      const r = await db.guardarMensual(mes, { [campo]: valor });
      fila.id = r.id; fila.user_id = r.user_id;
      render();
    }));
  }
});

document.addEventListener('keydown', async ev => {
  if (ev.target.dataset?.edicion !== undefined) {
    if (ev.key === 'Enter') { ev.preventDefault(); guardarEdicion(ev.target); }
    if (ev.key === 'Escape') { estado.ui.editando = null; render(); }
    return;
  }
  if (ev.key !== 'Enter') return;
  const acc = ev.target.dataset?.enter;
  if (!acc) return;
  ev.preventDefault();
  await ACCIONES[acc]();
  render();
});

document.addEventListener('focusout', ev => {
  if (ev.target.dataset?.edicion !== undefined) guardarEdicion(ev.target, mouseApretado);
});

/* ---------- cerrar paneles flotantes al hacer clic afuera ---------- */
document.addEventListener('click', ev => {
  if (!estado.datos || ev.target.id === 'importFile') return;
  if ((estado.ui.panelRecordatorios || estado.ui.panelCuenta) && !ev.target.closest('[data-panel]')) {
    estado.ui.panelRecordatorios = false;
    estado.ui.panelCuenta = false;
    render();
  }
});

/* ---------- importar respaldo ---------- */
document.addEventListener('change', async ev => {
  if (ev.target.id !== 'importFile') return;
  const file = ev.target.files[0];
  ev.target.value = '';
  if (!file || !estado.datos) return;
  try {
    const texto = await file.text();
    const datos = JSON.parse(texto);
    const reemplazar = confirm(
      '¿Cómo querés importar este respaldo?\n\n' +
      'Aceptar = reemplazar todos tus datos actuales por los del archivo.\n' +
      'Cancelar = agregar el contenido del archivo sin borrar lo que ya tenés.'
    );
    $('#cargando').classList.remove('oculto');
    await db.importarTodo(datos, reemplazar ? 'reemplazar' : 'agregar');
    await cargar();
    aviso('Datos importados correctamente.');
  } catch (e) {
    console.error(e);
    $('#cargando').classList.add('oculto');
    aviso('No se pudo importar: revisá que sea un respaldo válido de OGGI.');
  }
});

/* ---------- arrastrar notas ---------- */
document.addEventListener('mousedown', ev => {
  const asa = ev.target.closest('[data-arrastrar]');
  if (asa) return arrastrarNota(ev, asa.dataset.arrastrar);
  const lienzo = ev.target.closest('[data-dibujar]');
  if (lienzo) return dibujar(ev, lienzo);
});

function arrastrarNota(ev, id) {
  ev.preventDefault();
  const n = D().notas.find(x => x.id === id);
  const el = $(`[data-nota="${id}"]`), tablero = $('#tablero');
  const ox = ev.clientX - el.offsetLeft, oy = ev.clientY - el.offsetTop;
  const zTop = Math.max(1, ...D().notas.map(x => x.z || 1)) + 1;
  el.style.zIndex = zTop;
  const mover = e => {
    n.x = Math.max(0, Math.min(tablero.clientWidth - NW - 4, e.clientX - ox));
    n.y = Math.max(0, e.clientY - oy);
    el.style.left = n.x + 'px';
    el.style.top = n.y + 'px';
  };
  const fin = () => {
    removeEventListener('mousemove', mover); removeEventListener('mouseup', fin);
    n.z = zTop;
    colocarNotas();
    seguro(() => db.actualizar('notas', id, { x: n.x, y: n.y, z: zTop }));
  };
  addEventListener('mousemove', mover); addEventListener('mouseup', fin);
}

function dibujar(ev, lienzo) {
  ev.preventDefault();
  const id = lienzo.dataset.dibujar;
  const n = D().notas.find(x => x.id === id);
  const caja = lienzo.getBoundingClientRect(), k = NW / caja.width;
  const svg = lienzo.parentElement.querySelector('svg');
  const linea = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  linea.setAttribute('fill', 'none');
  linea.setAttribute('stroke', '#5A5A60');
  linea.setAttribute('stroke-width', '2.2');
  linea.setAttribute('stroke-linecap', 'round');
  linea.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(linea);
  let pts = '';
  const punto = e => { pts += Math.round((e.clientX - caja.left) * k) + ',' + Math.round((e.clientY - caja.top) * k) + ' '; linea.setAttribute('points', pts); };
  punto(ev);
  const mover = e => punto(e);
  const fin = () => {
    removeEventListener('mousemove', mover); removeEventListener('mouseup', fin);
    n.trazos = [...(n.trazos || []), { id: crypto.randomUUID(), color: '#5A5A60', pts }];
    seguro(() => db.actualizar('notas', id, { trazos: n.trazos }));
  };
  addEventListener('mousemove', mover); addEventListener('mouseup', fin);
}

/* ---------- arrastrar eventos entre horas ---------- */
document.addEventListener('dragstart', ev => {
  const el = ev.target.closest('[data-ev]');
  if (el) ev.dataTransfer.setData('text/plain', el.dataset.ev);
});
document.addEventListener('dragover', ev => { if (ev.target.closest('[data-drop]')) ev.preventDefault(); });
document.addEventListener('drop', ev => {
  const z = ev.target.closest('[data-drop]');
  if (!z) return;
  ev.preventDefault();
  const id = ev.dataTransfer.getData('text/plain');
  const e = D().eventos.find(x => x.id === id);
  if (!e) return;
  e.hora = z.dataset.drop === 'null' ? null : +z.dataset.drop;
  render();
  seguro(() => db.actualizar('eventos', id, { hora: e.hora }));
});

addEventListener('resize', () => { if (estado.datos && estado.ui.pestana === 'inicio') colocarNotas(); });
