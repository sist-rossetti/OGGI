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
const FUENTES = [
  { f: 'Montserrat, sans-serif', s: '14px' },
  { f: 'Caveat, cursive',        s: '21px' },
  { f: '"Space Mono", monospace', s: '13px' }
];
const SENALADORES = ['★', '⚑', '♥', '●'];
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
const num = v => { const n = parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
const money = n => '$' + Math.round(n).toLocaleString('es-AR');
const pal = i => PAL[((i | 0) % 6 + 6) % 6];
const fechaCorta = f => f ? (+String(f).slice(8) + ' ' + MES3[+String(f).slice(5,7) - 1]) : '';
const $ = s => document.querySelector(s);

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

/* ---------- animación "pop" al completar ---------- */
let popId = null;
function pop(id) {
  popId = id;
  setTimeout(() => { if (popId === id) { popId = null; render(); } }, 320);
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
    sinConexion: false, habitosSemana: null, dineroMes: null
  }
};
const b = (k, v) => { if (v !== undefined) estado.ui.borradores[k] = v; return estado.ui.borradores[k] ?? ''; };
const limpiar = (...ks) => ks.forEach(k => { estado.ui.borradores[k] = ''; });
const D = () => estado.datos;

/* ------------------------------------------------------------------ */
/* arranque                                                            */
/* ------------------------------------------------------------------ */
(async function inicio() {
  const s = await db.sesion();
  if (s) await cargar(); else mostrarAcceso();
  db.sb.auth.onAuthStateChange((ev) => {
    if (ev === 'SIGNED_OUT') { estado.datos = null; mostrarAcceso(); }
  });
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
function traducir(m = '') {
  if (/invalid login/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/already registered/i.test(m)) return 'Ese correo ya tiene cuenta.';
  if (/at least 6/i.test(m)) return 'La contraseña necesita al menos 6 caracteres.';
  if (/rate limit/i.test(m)) return 'Demasiados intentos. Probá en un minuto.';
  return m || 'Algo salió mal.';
}

/* ------------------------------------------------------------------ */
/* render                                                              */
/* ------------------------------------------------------------------ */
const PESTANAS = [
  ['inicio','Inicio'], ['calendario','Calendario'], ['tareas','Tareas'],
  ['proyectos','Proyectos'], ['habitos','Hábitos'], ['dinero','Dinero']
];

function render() {
  if (!estado.datos) return;
  const foco = document.activeElement?.dataset?.f;
  const pos = document.activeElement?.selectionStart;
  const u = estado.ui;
  const vistas = { inicio: vInicio, calendario: vCalendario, tareas: vTareas, proyectos: vProyectos, habitos: vHabitos, dinero: vDinero };
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
    if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) {} }
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
  d.notas.filter(n => hit(n.texto)).forEach(n => r.push([n.texto.slice(0, 60) || 'Nota vacía', 'Nota', pal(n.color).bar, { pestana: 'inicio' }]));
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
            return `<div style="display:flex;gap:12px;align-items:center;padding:12px 14px;border-radius:16px;background:${pal(e.color).bg}">
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
        <div style="display:flex;gap:7px">
          ${PAL.map((p, i) => `<button data-acc="notaColor" data-i="${i}" title="${p.n}" style="width:22px;height:22px;border-radius:50%;cursor:pointer;background:${p.bg};border:2px solid ${estado.ui.notaColor === i ? '#8A8A90' : 'transparent'}"></button>`).join('')}
        </div>
        <div style="display:flex;gap:6px">
          ${FUENTES.map((f, i) => `<button data-acc="notaFuente" data-i="${i}" style="cursor:pointer;border:1px solid ${estado.ui.notaFuente === i ? '#D6D6DA' : 'var(--borde)'};background:${estado.ui.notaFuente === i ? '#F2F2F4' : '#FFF'};border-radius:999px;padding:6px 14px;font-size:13px;font-family:${f.f}">Aa</button>`).join('')}
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
  const f = FUENTES[(n.fuente | 0) % 3];
  const dibujando = estado.ui.dibujo === n.id;
  return `<div class="nota" data-nota="${n.id}" style="background:${pal(n.color).bg};z-index:${n.z || 1}">
    <div class="asa" data-arrastrar="${n.id}"><i></i></div>
    <textarea data-f="nota-${n.id}" data-texto="${n.id}" placeholder="Escribí acá…" style="font-family:${f.f};font-size:${f.s}">${esc(n.texto)}</textarea>
    <svg viewBox="0 0 ${NW} ${NW}">${(n.trazos || []).map(t => `<polyline points="${t.pts}" fill="none" stroke="${t.color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></polyline>`).join('')}</svg>
    <button class="icono" data-senalador="${n.id}" title="Señalador" style="position:absolute;top:14px;right:10px;font-size:13px;line-height:1;padding:2px;color:#5A5A60;${n.senalador == null ? 'opacity:.3' : ''}">${n.senalador == null ? '◇' : SENALADORES[n.senalador]}</button>
    ${dibujando ? `<div class="lienzo" data-dibujar="${n.id}"></div>` : ''}
    <div class="pie">
      ${PAL.map((p, i) => `<button class="sw" data-notacolor="${n.id}" data-i="${i}" style="background:${p.bg}"></button>`).join('')}
      <button class="icono" data-modo-dibujo="${n.id}" title="Dibujar" style="margin-left:auto;font-size:11px;border-radius:6px;padding:4px 6px;background:${dibujando ? 'rgba(255,255,255,.75)' : 'transparent'};color:${dibujando ? '#4A4A4E' : 'var(--txt3)'}">✎</button>
      <button class="icono" data-borrar-dibujo="${n.id}" title="Borrar dibujo" style="font-size:11px">⌫</button>
      <button class="icono" data-fuente="${n.id}" title="Tipografía" style="font-size:12px;color:#7A7A80">Aa</button>
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
    const bloque = e => `<div class="bloque" draggable="true" data-ev="${e.id}" style="background:${pal(e.color).bg}">
      <span>${esc(e.titulo)}</span><button class="icono" data-borrar-ev="${e.id}" style="font-size:14px">×</button></div>`;
    const horas = [];
    for (let h = 7; h <= 22; h++) {
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
            <div style="background:${pal(e.color).bg};border-radius:9px;padding:6px 8px">
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
        ${delMes.map(e => `<div style="display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:14px;background:${pal(e.color).bg}">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.titulo)}</div>
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
      <input class="campo" style="border-radius:16px;padding:14px 16px;background:#FFF" data-f="tarea" data-b="tarea" data-enter="addTarea" placeholder="Nueva tarea…" value="${esc(b('tarea'))}">
      <button class="primario" style="border-radius:16px;padding:0 24px" data-acc="addTarea">+</button>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;align-items:center">
      <span class="mini" style="letter-spacing:.12em;margin-right:4px">Etiqueta</span>
      ${TAGS.map((t, i) => `<button data-acc="tareaEtq" data-i="${t}" style="cursor:pointer;border:1px solid ${u.tareaEtq === t ? pal(i).bar : 'var(--borde)'};background:${u.tareaEtq === t ? pal(i).bg : '#FFF'};border-radius:999px;padding:6px 12px;font-size:11px;color:#5A5A60">${t}</button>`).join('')}
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px;align-items:center">
      <span class="mini" style="letter-spacing:.12em;margin-right:4px">Filtrar</span>
      ${['Todas', ...TAGS].map(t => `<button data-acc="tareaFiltro" data-i="${t}" style="cursor:pointer;border:1px solid ${u.tareaFiltro === t ? '#3B3B3F' : 'var(--borde)'};background:${u.tareaFiltro === t ? '#3B3B3F' : '#FFF'};color:${u.tareaFiltro === t ? '#FFF' : '#5A5A60'};border-radius:999px;padding:6px 12px;font-size:11px">${t}</button>`).join('')}
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${vis.map(t => `<div class="tarea">
        <button class="check${popId === t.id ? ' pop' : ''}" data-tarea="${t.id}" style="${t.hecha ? 'border-color:#B4DCBC;background:#B4DCBC' : ''}">${t.hecha ? '✓' : ''}</button>
        <div style="flex:1;min-width:0;font-size:14px;${t.hecha ? 'color:var(--txt5);text-decoration:line-through' : ''}">${esc(t.texto)}</div>
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
        <input class="campo" style="width:240px;background:#FFF" data-f="proy" data-b="proy" data-enter="addProyecto" placeholder="Nombre del proyecto" value="${esc(b('proy'))}">
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
      <div style="font-size:22px;font-weight:500">${esc(p.nombre)}</div>
      <button class="pill" style="margin-left:auto;color:var(--peligro)" data-acc="borrarProyecto">Eliminar</button>
    </div>
    <div class="tarjeta" style="overflow:hidden">
      <div style="background:${pal(p.color).bg};padding:26px;display:flex;gap:26px;align-items:center;flex-wrap:wrap">
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
            <button class="check${popId === s.id ? ' pop' : ''}" data-paso="${s.id}" style="width:26px;height:26px;font-size:12px;${s.hecho ? `border-color:${pal(p.color).bar};background:${pal(p.color).bar}` : ''}">${s.hecho ? '✓' : ''}</button>
            <div style="flex:1;width:2px;min-height:22px;background:${s.hecho ? pal(p.color).bg : 'var(--borde-suave)'}"></div>
          </div>
          <div style="flex:1;padding-bottom:22px">
            <div style="font-size:15px;${s.hecho ? 'color:var(--txt4);text-decoration:line-through' : ''}">${esc(s.texto)}</div>
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
  const d = D(), n = estado.ui.ahora, hoy = kf(n);
  if (!estado.ui.habitosSemana) estado.ui.habitosSemana = kf(lunesDe(n));
  const inicio = new Date(estado.ui.habitosSemana + 'T00:00:00');
  const fin = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 6);
  const esSemanaActual = estado.ui.habitosSemana === kf(lunesDe(n));
  const dias = Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
    return { k: kf(dd), nom: DIAS[dd.getDay()].slice(0, 3), num: dd.getDate() };
  });
  const marcado = (h, k) => d.habito_marcas.some(m => m.habito_id === h.id && m.fecha === k);
  const hechosHoy = d.habitos.filter(h => marcado(h, hoy)).length;

  return `<div style="max-width:860px;margin:0 auto">
    <div style="display:flex;align-items:baseline;gap:14px;margin-bottom:20px;flex-wrap:wrap">
      <div style="font-size:22px;font-weight:500">Hábitos</div>
      <div style="font-size:12px;color:var(--txt4)">${hechosHoy} de ${d.habitos.length} hechos hoy</div>
    </div>
    <div style="display:flex;gap:10px;margin-bottom:20px">
      <input class="campo" style="border-radius:16px;padding:14px 16px;background:#FFF" data-f="hab" data-b="hab" data-enter="addHabito" placeholder="Nuevo hábito… (ej. leer 20 min)" value="${esc(b('hab'))}">
      <button class="primario" style="border-radius:16px;padding:0 24px" data-acc="addHabito">+</button>
    </div>
    <div class="tarjeta" style="padding:22px 24px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
        <div style="font-size:13px;color:var(--txt3)">${inicio.getDate()} ${MES3[inicio.getMonth()]} — ${fin.getDate()} ${MES3[fin.getMonth()]}</div>
        <div style="display:flex;gap:8px;margin-left:auto;align-items:center">
          ${esSemanaActual ? '' : `<button class="pill" data-acc="habitosHoy">Hoy</button>`}
          <button class="redondo" data-acc="habitosSemana" data-i="-1">‹</button>
          <button class="redondo" data-acc="habitosSemana" data-i="1">›</button>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <div style="flex:1"></div>
        <div style="flex:0 0 auto;display:flex;gap:8px">
          ${dias.map(x => `<div style="width:34px;text-align:center">
            <div style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--txt5)">${x.nom}</div>
            <div style="font-size:11px;color:${x.k === hoy ? 'var(--sel-fg)' : 'var(--txt5)'};margin-top:2px">${x.num}</div>
          </div>`).join('')}
        </div>
        <div style="flex:0 0 54px;text-align:right;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--txt5)">Racha</div>
        <div style="flex:0 0 20px"></div>
      </div>
      ${d.habitos.length ? d.habitos.map(h => {
        let racha = 0;
        for (let i = 0; i < 400; i++) {
          const dd = new Date(n.getFullYear(), n.getMonth(), n.getDate() - i);
          if (marcado(h, kf(dd))) racha++; else break;
        }
        return `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--borde-fino)">
          <div style="flex:1;min-width:0;display:flex;align-items:center;gap:10px">
            <span style="flex:0 0 auto;width:10px;height:10px;border-radius:50%;background:${pal(h.color).bar}"></span>
            <span style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(h.nombre)}</span>
          </div>
          <div style="flex:0 0 auto;display:flex;gap:8px">
            ${dias.map(x => { const on = marcado(h, x.k); return `<button class="celda${popId === h.id + x.k ? ' pop' : ''}" data-marca="${h.id}" data-fecha="${x.k}" style="${on ? `background:${pal(h.color).bg};border-color:${pal(h.color).bar}` : ''}">${on ? '✓' : ''}</button>`; }).join('')}
          </div>
          <div style="flex:0 0 54px;text-align:right;font-size:13px;color:var(--txt2)">${racha}d</div>
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
  const d = D(), u = estado.ui, hoy = kf(u.ahora);
  if (!u.dineroMes) u.dineroMes = hoy.slice(0, 7);
  const mes = u.dineroMes;
  const esMesActual = mes === hoy.slice(0, 7);
  const [añoSel, mesSel] = mes.split('-').map(Number);
  const dAnt = new Date(añoSel, mesSel - 2, 1);
  const mesAnterior = dAnt.getFullYear() + '-' + pad(dAnt.getMonth() + 1);
  const base = num(d.perfil.dinero_base), meta = num(d.perfil.meta_ahorro);
  const delMes = (l, m = mes) => l.filter(x => String(x.fecha).slice(0, 7) === m);
  const suma = l => l.reduce((a, x) => a + num(x.monto), 0);
  const vars = delMes(d.gastos_variables), ings = delMes(d.ingresos);
  const sF = suma(d.gastos_fijos), sV = suma(vars), sI = suma(ings), sA = suma(d.ahorros);
  const gastos = sF + sV, entra = base + sI, disp = entra - gastos - sA;
  const gastosAnt = sF + suma(delMes(d.gastos_variables, mesAnterior));
  const deltaGasto = gastosAnt > 0 ? Math.round((gastos - gastosAnt) * 100 / gastosAnt) : null;
  const pctG = entra > 0 ? Math.min(100, Math.round(gastos * 100 / entra)) : 0;
  const pctA = meta > 0 ? Math.min(100, Math.round(sA * 100 / meta)) : 0;
  const pagado = g => d.gastos_fijos_pagos.some(p => p.gasto_id === g.id && p.mes === mes);
  const pagadoProg = a => d.ahorros_programados_pagos.some(p => p.ahorro_id === a.id && p.mes === mes);
  const sAP = suma(d.ahorros_programados);
  const cumplidoAP = d.ahorros_programados.filter(pagadoProg).length;
  const cols = innerWidth < 900 ? '1fr' : innerWidth < 1180 ? 'repeat(2,minmax(0,1fr))' : 'repeat(3,minmax(0,1fr))';
  const porCat = {};
  vars.forEach(g => { porCat[g.categoria] = (porCat[g.categoria] || 0) + num(g.monto); });
  const topCats = Object.entries(porCat).sort((a, x) => x[1] - a[1]).slice(0, 5);

  return `<div style="display:flex;flex-direction:column;gap:20px">
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <div style="font-size:20px;font-weight:500;margin-right:auto">${MESES[mesSel - 1]} ${añoSel}</div>
      <div style="display:flex;gap:8px;align-items:center">
        ${esMesActual ? '' : `<button class="pill" data-acc="dineroHoy">Hoy</button>`}
        <button class="redondo" data-acc="dineroMes" data-i="-1">‹</button>
        <button class="redondo" data-acc="dineroMes" data-i="1">›</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:16px">
      <div class="tarjeta" style="padding:22px">
        <div class="mini">Dinero base</div>
        <div style="display:flex;align-items:baseline;gap:4px;margin-top:8px">
          <span style="font-size:17px;color:var(--txt5)">$</span>
          <input data-f="base" data-perfil="dinero_base" value="${base || ''}" placeholder="0" style="width:100%;border:none;background:transparent;font-size:28px;font-weight:300;padding:0">
        </div>
        <div style="font-size:11px;color:var(--txt5);margin-top:6px">Con lo que arrancás el mes</div>
      </div>
      <div class="tarjeta" style="padding:22px;background:${disp < 0 ? '#FADDE1' : '#D8E8F7'}">
        <div class="mini" style="color:var(--txt2)">Disponible</div>
        <div style="font-size:28px;font-weight:300;margin-top:8px">${money(disp)}</div>
        <div style="font-size:11px;color:var(--txt2);margin-top:6px">${disp < 0 ? 'Estás gastando de más' : 'Después de gastos y ahorro'}</div>
      </div>
      <div class="tarjeta" style="padding:22px">
        <div class="mini">Gastado este mes</div>
        <div style="font-size:28px;font-weight:300;margin-top:8px">${money(gastos)}</div>
        <div class="barra" style="margin-top:12px"><i style="width:${pctG}%;background:#EFBCC4"></i></div>
        <div style="font-size:11px;color:var(--txt5);margin-top:7px">${entra > 0 ? pctG + '% de lo que entró' : 'Cargá tu dinero base'}</div>
        ${deltaGasto == null ? '' : `<div style="font-size:11px;color:${deltaGasto > 0 ? 'var(--peligro)' : 'var(--txt5)'};margin-top:3px">${deltaGasto > 0 ? '▲' : deltaGasto < 0 ? '▼' : '–'} ${Math.abs(deltaGasto)}% vs mes anterior</div>`}
      </div>
      <div class="tarjeta" style="padding:22px">
        <div class="mini">Ahorrado</div>
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
          ${d.gastos_fijos.length ? d.gastos_fijos.map(g => { const pg = pagado(g); return `
            <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:${pal(g.color).bg}">
              <button class="check${popId === g.id ? ' pop' : ''}" data-pago="${g.id}" style="width:20px;height:20px;font-size:10px;${pg ? `border-color:${pal(g.color).bar};background:${pal(g.color).bar}` : 'border-color:rgba(0,0,0,.12);background:transparent'}">${pg ? '✓' : ''}</button>
              <div style="flex:1;min-width:0">
                <div style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${pg ? 'color:#8A8A90' : ''}">${esc(g.nombre)}</div>
                <div style="font-size:11px;color:var(--txt2);margin-top:2px">${pg ? 'Pagado este mes' : 'Pendiente'}</div>
              </div>
              <div style="font-size:14px;font-weight:500">${money(num(g.monto))}</div>
              <button class="icono" data-borrar-fijo="${g.id}">×</button>
            </div>`; }).join('') : '<div style="padding:14px 2px;font-size:13px;color:var(--txt4)">Alquiler, luz, internet… lo que se repite todos los meses.</div>'}
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
        ${topCats.length ? `<div style="display:flex;flex-direction:column;gap:5px;margin-bottom:14px;padding:12px 14px;background:var(--sutil);border-radius:14px">
          <div class="mini" style="margin-bottom:2px">Top gastos por categoría</div>
          ${topCats.map(([cat, monto], i) => `<div style="display:flex;align-items:center;gap:8px">
            <span style="flex:1;font-size:12px;color:var(--txt2)">${i + 1}. ${esc(cat)}</span>
            <span style="font-size:12px;font-weight:500">${money(monto)}</span>
            <span style="font-size:11px;color:var(--txt4);width:36px;text-align:right">${sV > 0 ? Math.round(monto * 100 / sV) : 0}%</span>
          </div>`).join('')}
        </div>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          ${CATS.map((c, i) => `<button data-acc="varCat" data-i="${c}" style="cursor:pointer;border:1px solid ${u.varCat === c ? pal(i).bar : 'var(--borde)'};background:${u.varCat === c ? pal(i).bg : '#FFF'};border-radius:999px;padding:6px 12px;font-size:11px;color:#5A5A60">${c}</button>`).join('')}
        </div>
        ${esMesActual ? `<div style="display:flex;gap:8px;margin-bottom:16px">
          <input class="campo" data-f="vN" data-b="vN" data-enter="addVar" placeholder="¿En qué gastaste?" value="${esc(b('vN'))}">
          <input class="campo" style="flex:0 0 94px" data-f="vM" data-b="vM" data-enter="addVar" placeholder="$" value="${esc(b('vM'))}">
          <button class="primario" style="padding:0 18px" data-acc="addVar">+</button>
        </div>` : `<div style="font-size:12px;color:var(--txt4);margin-bottom:16px;padding:2px">Volvé al mes actual para agregar gastos nuevos.</div>`}
        <div style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto">
          ${vars.length ? vars.map(g => `<div style="display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:14px;border:1px solid var(--borde-fino)">
            <span style="flex:0 0 auto;width:9px;height:9px;border-radius:50%;background:${pal(Math.max(0, CATS.indexOf(g.categoria))).bar}"></span>
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(g.nombre)}</div>
              <div style="font-size:11px;color:var(--txt4);margin-top:2px">${esc(g.categoria)} · ${fechaCorta(g.fecha)}</div>
            </div>
            <div style="font-size:14px;font-weight:500">${money(num(g.monto))}</div>
            <button class="icono" data-borrar-var="${g.id}">×</button>
          </div>`).join('') : '<div style="padding:14px 2px;font-size:13px;color:var(--txt4)">Todavía no registraste gastos este mes.</div>'}
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:20px">
        <div class="tarjeta" style="padding:24px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
            <div class="rotulo" style="margin-right:auto">Otros ingresos</div>
            <div style="font-size:13px;color:var(--txt2)">${money(sI)}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
            ${ings.length ? ings.map(i => `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:#DCEFDF">
              <div style="flex:1;min-width:0">
                <div style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(i.origen)}</div>
                <div style="font-size:11px;color:var(--txt2);margin-top:2px">${i.detalle ? esc(i.detalle) + ' · ' : ''}${fechaCorta(i.fecha)}</div>
              </div>
              <div style="font-size:14px;font-weight:500">${money(num(i.monto))}</div>
              <button class="icono" data-borrar-ing="${i.id}">×</button>
            </div>`).join('') : '<div style="padding:14px 2px;font-size:13px;color:var(--txt4)">Trabajos extra, ventas, regalos.</div>'}
          </div>
          ${esMesActual ? `<div style="display:flex;flex-direction:column;gap:8px">
            <input class="campo" data-f="iO" data-b="iO" data-enter="addIngreso" placeholder="¿De dónde viene?" value="${esc(b('iO'))}">
            <div style="display:flex;gap:8px">
              <input class="campo" data-f="iD" data-b="iD" data-enter="addIngreso" placeholder="Detalle (opcional)" value="${esc(b('iD'))}">
              <input class="campo" style="flex:0 0 94px" data-f="iM" data-b="iM" data-enter="addIngreso" placeholder="$" value="${esc(b('iM'))}">
              <button class="primario" style="padding:0 18px" data-acc="addIngreso">+</button>
            </div>
          </div>` : `<div style="font-size:12px;color:var(--txt4);padding:2px">Volvé al mes actual para agregar ingresos nuevos.</div>`}
        </div>

        <div class="tarjeta" style="padding:24px">
          <div class="rotulo" style="margin-bottom:18px">Ahorro</div>
          <div style="display:flex;align-items:center;gap:20px;margin-bottom:18px">
            <div style="position:relative;width:92px;height:92px;border-radius:50%;flex:0 0 auto;background:conic-gradient(#B4DCBC ${pctA}%, var(--borde-suave) 0)">
              <div style="position:absolute;inset:10px;border-radius:50%;background:#FFF;display:flex;flex-direction:column;align-items:center;justify-content:center">
                <div style="font-size:19px;font-weight:300">${pctA}%</div>
                <div style="font-size:8px;letter-spacing:.06em;text-transform:uppercase;color:var(--txt4)">meta</div>
              </div>
            </div>
            <div style="flex:1;min-width:0">
              <div class="mini" style="margin-bottom:6px">Meta de ahorro</div>
              <div style="display:flex;align-items:baseline;gap:4px">
                <span style="font-size:15px;color:var(--txt5)">$</span>
                <input data-f="meta" data-perfil="meta_ahorro" value="${meta || ''}" placeholder="0" style="width:100%;border:none;background:transparent;font-size:22px;font-weight:300;padding:0">
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
            ${d.ahorros.map(a => `<div style="display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:14px;background:#F7FAF8">
              <div style="flex:1;min-width:0">
                <div style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.nombre)}</div>
                <div style="font-size:11px;color:var(--txt4);margin-top:2px">${fechaCorta(a.fecha)}</div>
              </div>
              <div style="font-size:14px;font-weight:500">${money(num(a.monto))}</div>
              <button class="icono" data-borrar-ahorro="${a.id}">×</button>
            </div>`).join('')}
          </div>
        </div>

        <div class="tarjeta" style="padding:24px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
            <div class="rotulo" style="margin-right:auto">Ahorro programado</div>
            <div style="font-size:13px;color:var(--txt2)">${money(sAP)} / mes</div>
          </div>
          ${d.ahorros_programados.length ? `<div style="font-size:11px;color:var(--txt5);margin-bottom:12px">${cumplidoAP} de ${d.ahorros_programados.length} cumplidos este mes</div>` : ''}
          <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
            ${d.ahorros_programados.length ? d.ahorros_programados.map(a => { const pg = pagadoProg(a); return `
              <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:${pal(a.color).bg}">
                <button class="check${popId === a.id ? ' pop' : ''}" data-pagoprog="${a.id}" style="width:20px;height:20px;font-size:10px;${pg ? `border-color:${pal(a.color).bar};background:${pal(a.color).bar}` : 'border-color:rgba(0,0,0,.12);background:transparent'}">${pg ? '✓' : ''}</button>
                <div style="flex:1;min-width:0">
                  <div style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${pg ? 'color:#8A8A90' : ''}">${esc(a.nombre)}</div>
                  <div style="font-size:11px;color:var(--txt2);margin-top:2px">${pg ? 'Cumplido este mes' : 'Pendiente'}</div>
                </div>
                <div style="font-size:14px;font-weight:500">${money(num(a.monto))}</div>
                <button class="icono" data-borrar-ahorroprog="${a.id}">×</button>
              </div>`; }).join('') : '<div style="padding:14px 2px;font-size:13px;color:var(--txt4)">Un monto fijo que planeás ahorrar cada mes (ej. "Plazo fijo").</div>'}
          </div>
          <div style="display:flex;gap:8px">
            <input class="campo" data-f="apN" data-b="apN" data-enter="addAhorroProg" placeholder="Concepto" value="${esc(b('apN'))}">
            <input class="campo" style="flex:0 0 94px" data-f="apM" data-b="apM" data-enter="addAhorroProg" placeholder="$" value="${esc(b('apM'))}">
            <button class="primario" style="padding:0 18px" data-acc="addAhorroProg">+</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* acciones                                                            */
/* ------------------------------------------------------------------ */
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
  semana: i => {
    const w = new Date(estado.ui.semana + 'T00:00:00');
    estado.ui.semana = kf(new Date(w.getFullYear(), w.getMonth(), w.getDate() + (+i) * 7));
  },
  habitosSemana: i => {
    const w = new Date(estado.ui.habitosSemana + 'T00:00:00');
    estado.ui.habitosSemana = kf(new Date(w.getFullYear(), w.getMonth(), w.getDate() + (+i) * 7));
  },
  habitosHoy: () => { estado.ui.habitosSemana = kf(lunesDe(estado.ui.ahora)); },
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

  addFijo: () => seguro(async () => {
    const n = b('fN').trim(); if (!n) return;
    const g = await db.crear('gastos_fijos', { nombre: n, monto: num(b('fM')), color: D().gastos_fijos.length % 6 });
    D().gastos_fijos.push(g); limpiar('fN', 'fM');
  }),
  addVar: () => seguro(async () => {
    const n = b('vN').trim(); if (!n) return;
    const g = await db.crear('gastos_variables', { nombre: n, monto: num(b('vM')), categoria: estado.ui.varCat, fecha: kf(estado.ui.ahora) });
    D().gastos_variables.unshift(g); limpiar('vN', 'vM');
  }),
  addIngreso: () => seguro(async () => {
    const n = b('iO').trim(); if (!n) return;
    const i = await db.crear('ingresos', { origen: n, detalle: b('iD').trim(), monto: num(b('iM')), fecha: kf(estado.ui.ahora) });
    D().ingresos.unshift(i); limpiar('iO', 'iD', 'iM');
  }),
  addAhorro: () => seguro(async () => {
    if (!num(b('aM'))) return;
    const a = await db.crear('ahorros', { nombre: b('aN').trim() || 'Aporte', monto: num(b('aM')), fecha: kf(estado.ui.ahora) });
    D().ahorros.unshift(a); limpiar('aN', 'aM');
  }),

  dineroMes: i => {
    const [a, m] = estado.ui.dineroMes.split('-').map(Number);
    const dd = new Date(a, m - 1 + (+i), 1);
    estado.ui.dineroMes = dd.getFullYear() + '-' + pad(dd.getMonth() + 1);
  },
  dineroHoy: () => { estado.ui.dineroMes = kf(estado.ui.ahora).slice(0, 7); },
  addAhorroProg: () => seguro(async () => {
    const nom = b('apN').trim(); if (!nom) return;
    const a = await db.crear('ahorros_programados', { nombre: nom, monto: num(b('apM')), color: D().ahorros_programados.length % 6 });
    D().ahorros_programados.push(a); limpiar('apN', 'apM');
  })
};

/* ---------- delegación de eventos ---------- */
document.addEventListener('click', async ev => {
  const el = ev.target.closest('[data-acc],[data-tab],[data-ir],[data-dia],[data-proyecto],[data-tarea],[data-paso],[data-marca],[data-pago],[data-pagoprog],[data-etq-proy],[data-notacolor],[data-fuente],[data-senalador],[data-modo-dibujo],[data-borrar-dibujo],[data-borrar-nota],[data-borrar-ev],[data-borrar-tarea],[data-borrar-paso],[data-borrar-pnota],[data-borrar-habito],[data-borrar-fijo],[data-borrar-var],[data-borrar-ing],[data-borrar-ahorro],[data-borrar-ahorroprog]');
  if (!el || !estado.datos) return;
  const s = el.dataset;

  // Caso especial: no re-renderizamos acá, para no perder la referencia
  // al <input type="file"> justo cuando se abre el selector del sistema.
  if (s.acc === 'importarClick') { $('#importFile')?.click(); return; }
  if (s.acc) { await ACCIONES[s.acc]?.(s.i); return render(); }
  if (s.tab) { Object.assign(estado.ui, { pestana: s.tab, selDia: null, proyecto: null, q: '', panelRecordatorios: false, panelCuenta: false }); return render(); }
  if (s.ir) { Object.assign(estado.ui, JSON.parse(s.ir), { q: '', panelRecordatorios: false, panelCuenta: false }); return render(); }
  if (s.dia) { estado.ui.selDia = s.dia; return render(); }
  if (s.proyecto) { estado.ui.proyecto = s.proyecto; return render(); }

  if (s.tarea) { const t = D().tareas.find(x => x.id === s.tarea); t.hecha = !t.hecha; if (t.hecha) pop(t.id); render(); return seguro(() => db.actualizar('tareas', t.id, { hecha: t.hecha })); }
  if (s.paso)  { const p = D().proyecto_pasos.find(x => x.id === s.paso); p.hecho = !p.hecho; if (p.hecho) pop(p.id); render(); return seguro(() => db.actualizar('proyecto_pasos', p.id, { hecho: p.hecho })); }
  if (s.etqProy) { const p = D().proyectos.find(x => x.id === estado.ui.proyecto); p.etiqueta = s.etqProy; render(); return seguro(() => db.actualizar('proyectos', p.id, { etiqueta: s.etqProy })); }

  if (s.marca) {
    const m = D().habito_marcas.find(x => x.habito_id === s.marca && x.fecha === s.fecha);
    if (m) { D().habito_marcas = D().habito_marcas.filter(x => x !== m); render(); return seguro(() => db.borrar('habito_marcas', m.id)); }
    pop(s.marca + s.fecha); render();
    return seguro(async () => { D().habito_marcas.push(await db.crear('habito_marcas', { habito_id: s.marca, fecha: s.fecha })); render(); });
  }
  if (s.pago) {
    const mes = estado.ui.dineroMes || kf(estado.ui.ahora).slice(0, 7);
    const p = D().gastos_fijos_pagos.find(x => x.gasto_id === s.pago && x.mes === mes);
    if (p) { D().gastos_fijos_pagos = D().gastos_fijos_pagos.filter(x => x !== p); render(); return seguro(() => db.borrar('gastos_fijos_pagos', p.id)); }
    pop(s.pago); render();
    return seguro(async () => { D().gastos_fijos_pagos.push(await db.crear('gastos_fijos_pagos', { gasto_id: s.pago, mes })); render(); });
  }
  if (s.pagoprog) {
    const mes = estado.ui.dineroMes || kf(estado.ui.ahora).slice(0, 7);
    const p = D().ahorros_programados_pagos.find(x => x.ahorro_id === s.pagoprog && x.mes === mes);
    if (p) { D().ahorros_programados_pagos = D().ahorros_programados_pagos.filter(x => x !== p); render(); return seguro(() => db.borrar('ahorros_programados_pagos', p.id)); }
    pop(s.pagoprog); render();
    return seguro(async () => { D().ahorros_programados_pagos.push(await db.crear('ahorros_programados_pagos', { ahorro_id: s.pagoprog, mes })); render(); });
  }

  if (s.notacolor) { const n = D().notas.find(x => x.id === s.notacolor); n.color = +s.i; render(); return seguro(() => db.actualizar('notas', n.id, { color: n.color })); }
  if (s.fuente)    { const n = D().notas.find(x => x.id === s.fuente); n.fuente = ((n.fuente | 0) + 1) % 3; render(); return seguro(() => db.actualizar('notas', n.id, { fuente: n.fuente })); }
  if (s.senalador) { const n = D().notas.find(x => x.id === s.senalador); n.senalador = n.senalador == null ? 0 : (n.senalador + 1 >= SENALADORES.length ? null : n.senalador + 1); render(); return seguro(() => db.actualizar('notas', n.id, { senalador: n.senalador })); }
  if (s.modoDibujo){ estado.ui.dibujo = estado.ui.dibujo === s.modoDibujo ? null : s.modoDibujo; return render(); }
  if (s.borrarDibujo) { const n = D().notas.find(x => x.id === s.borrarDibujo); n.trazos = []; render(); return seguro(() => db.actualizar('notas', n.id, { trazos: [] })); }

  const borrados = {
    borrarNota: 'notas', borrarEv: 'eventos', borrarTarea: 'tareas', borrarPaso: 'proyecto_pasos',
    borrarPnota: 'proyecto_notas', borrarHabito: 'habitos', borrarFijo: 'gastos_fijos',
    borrarVar: 'gastos_variables', borrarIng: 'ingresos', borrarAhorro: 'ahorros',
    borrarAhorroprog: 'ahorros_programados'
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
  if (s.perfil) {
    D().perfil[s.perfil] = num(ev.target.value);
    const campo = s.perfil, valor = D().perfil[campo];
    return db.guardarConRetardo('perfil' + campo, () => seguro(async () => {
      await db.guardarPerfil({ [campo]: valor });
      render();
    }));
  }
});

document.addEventListener('keydown', async ev => {
  if (ev.key !== 'Enter') return;
  const acc = ev.target.dataset?.enter;
  if (!acc) return;
  ev.preventDefault();
  await ACCIONES[acc]();
  render();
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
