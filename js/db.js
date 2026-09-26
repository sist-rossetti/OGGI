// Capa de datos: todo lo que habla con Supabase pasa por acá.
// El resto de la app no sabe que Supabase existe.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const TABLAS = [
  'notas', 'eventos', 'tareas', 'proyectos', 'proyecto_pasos', 'proyecto_notas',
  'habitos', 'habito_marcas', 'gastos_fijos', 'gastos_fijos_pagos',
  'gastos_variables', 'ingresos', 'ahorros', 'dinero_mensual', 'apuntes'
];
// Tablas agregadas después: si todavía no se corrió el esquema.sql nuevo,
// la app abre igual y avisa, en vez de no cargar nada.
const TABLAS_NUEVAS = ['dinero_mensual', 'apuntes'];

/* ---------- sesión ---------- */

export async function sesion() {
  const { data } = await sb.auth.getSession();
  return data.session;
}

export async function registrarse(email, password, nombre) {
  const { data, error } = await sb.auth.signUp({
    email, password, options: { data: { nombre } }
  });
  if (error) throw error;
  return data;
}

export async function entrar(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function salir() {
  await sb.auth.signOut();
}

export async function recuperar(email) {
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: location.origin + location.pathname
  });
  if (error) throw error;
}

// Se usa después de entrar con el enlace de "Olvidé mi contraseña".
export async function cambiarPassword(password) {
  const { error } = await sb.auth.updateUser({ password });
  if (error) throw error;
}

/* ---------- perfil ---------- */

export async function leerPerfil() {
  const { data, error } = await sb.from('perfiles').select('*').maybeSingle();
  if (error) throw error;
  return data || { dinero_base: 0, meta_ahorro: 0 };
}

export async function guardarPerfil(campos) {
  return conReintento(async () => {
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from('perfiles').upsert({ id: user.id, ...campos });
    if (error) throw error;
  });
}

/* ---------- dinero base y meta de cada mes ---------- */

// Crea la fila del mes si no existe, o actualiza solo los campos pasados.
export async function guardarMensual(mes, campos) {
  return conReintento(async () => {
    const { data: { user } } = await sb.auth.getUser();
    const { data, error } = await sb.from('dinero_mensual')
      .upsert({ user_id: user.id, mes, ...campos }, { onConflict: 'user_id,mes' })
      .select().single();
    if (error) throw error;
    return data;
  });
}

/* ---------- cuenta ---------- */

// Borra la cuenta entera (correo, contraseña y todos los datos, vía
// on delete cascade). Requiere la Edge Function "borrar-cuenta"
// desplegada en el proyecto de Supabase.
export async function borrarCuenta() {
  const { data, error } = await sb.functions.invoke('borrar-cuenta');
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

/* ---------- CRUD genérico ---------- */

// Orden estable al leer. Sin esto Postgres devuelve las filas en cualquier
// orden, y por ejemplo una tarea recién tildada aparece en otro lugar al
// recargar. Coincide con cómo app.js agrega las filas nuevas (push/unshift).
// (notas.actualizado_en nunca se modifica, así que equivale a la fecha de creación.)
const ORDEN = {
  notas: ['actualizado_en', true], eventos: ['fecha', true], tareas: ['creado_en', false],
  proyectos: ['creado_en', true], proyecto_pasos: ['orden', true], proyecto_notas: ['creado_en', true],
  habitos: ['creado_en', true], gastos_fijos: ['creado_en', true],
  gastos_variables: ['fecha', false], ingresos: ['fecha', false], ahorros: ['fecha', false],
  dinero_mensual: ['mes', true], apuntes: ['actualizado_en', false]
};

export async function traerTodo() {
  const out = {};
  await Promise.all(TABLAS.map(async t => {
    let q = sb.from(t).select('*');
    if (ORDEN[t]) q = q.order(ORDEN[t][0], { ascending: ORDEN[t][1] }).order('id');
    const { data, error } = await q;
    if (error) {
      if (TABLAS_NUEVAS.includes(t)) { (out.faltan ||= []).push(t); out[t] = []; return; }
      throw error;
    }
    out[t] = data || [];
  }));
  out.perfil = await leerPerfil();
  return out;
}

export async function crear(tabla, fila) {
  return conReintento(async () => {
    const { data, error } = await sb.from(tabla).insert(fila).select().single();
    if (error) throw error;
    return data;
  });
}

export async function actualizar(tabla, id, campos) {
  return conReintento(async () => {
    const { error } = await sb.from(tabla).update(campos).eq('id', id);
    if (error) throw error;
  });
}

export async function borrar(tabla, id) {
  return conReintento(async () => {
    const { error } = await sb.from(tabla).delete().eq('id', id);
    if (error) throw error;
  });
}

export async function borrarDonde(tabla, filtro) {
  return conReintento(async () => {
    let q = sb.from(tabla).delete();
    Object.entries(filtro).forEach(([k, v]) => { q = q.eq(k, v); });
    const { error } = await q;
    if (error) throw error;
  });
}

/* ---------- importar un respaldo (el JSON que genera "Exportar") ---------- */

// Orden que respeta las referencias entre tablas (padres antes que hijos).
const ORDEN_IMPORT = [
  'notas', 'eventos', 'tareas', 'proyectos', 'proyecto_pasos', 'proyecto_notas',
  'habitos', 'habito_marcas', 'gastos_fijos', 'gastos_fijos_pagos',
  'gastos_variables', 'ingresos', 'ahorros', 'dinero_mensual', 'apuntes'
];
// Tablas "padre": borrarlas alcanza, porque el resto cuelga de ellas con
// "on delete cascade" (ver esquema.sql).
const TABLAS_PADRE = ['notas', 'eventos', 'tareas', 'proyectos', 'habitos', 'gastos_fijos', 'gastos_variables', 'ingresos', 'ahorros', 'dinero_mensual', 'apuntes'];

export async function importarTodo(datos, modo = 'agregar') {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('No hay sesión activa.');

  if (modo === 'reemplazar') {
    for (const t of TABLAS_PADRE) {
      const { error } = await sb.from(t).delete().eq('user_id', user.id);
      if (error) throw error;
    }
  }

  for (const t of ORDEN_IMPORT) {
    const filas = Array.isArray(datos?.[t]) ? datos[t] : [];
    if (!filas.length) continue;
    // Se conserva el id original para no romper las referencias
    // (por ejemplo proyecto_pasos.proyecto_id), y se fuerza el user_id
    // a la cuenta actual para que las reglas de seguridad lo acepten.
    const limpio = filas.map(f => ({ ...f, user_id: user.id }));
    // dinero_mensual es único por mes: si ese mes ya existe, se actualiza.
    const { error } = t === 'dinero_mensual'
      ? await sb.from(t).upsert(limpio.map(({ id, ...f }) => f), { onConflict: 'user_id,mes' })
      : await sb.from(t).upsert(limpio, { onConflict: 'id' });
    if (error) throw error;
  }

  if (datos?.perfil) {
    const { dinero_base, meta_ahorro } = datos.perfil;
    await guardarPerfil({ dinero_base: dinero_base || 0, meta_ahorro: meta_ahorro || 0 });
  }
}

/* ---------- borrar todos mis datos (mantiene la cuenta) ---------- */

export async function borrarTodoMisDatos() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('No hay sesión activa.');
  for (const t of TABLAS_PADRE) {
    const { error } = await sb.from(t).delete().eq('user_id', user.id);
    if (error) throw error;
  }
  await guardarPerfil({ dinero_base: 0, meta_ahorro: 0 });
}

/* ---------- guardado con retardo (para el texto que se escribe) ---------- */

const pendientes = new Map();
export function guardarConRetardo(clave, fn, ms = 600) {
  clearTimeout(pendientes.get(clave));
  pendientes.set(clave, setTimeout(() => { pendientes.delete(clave); fn(); }, ms));
}

/* ---------- aviso de sin conexión + reintento ----------
   Si una escritura falla por caída de red (no por un error del servidor),
   queda en espera y se reintenta sola apenas vuelve la conexión. */

let sinConexion = false;
let avisar = null;
const cola = [];

export function alCambiarConexion(fn) { avisar = fn; }

function esErrorDeRed(e) {
  return e instanceof TypeError || /failed to fetch|network|fetch/i.test(e?.message || '');
}

function marcar(v) {
  if (sinConexion === v) return;
  sinConexion = v;
  avisar?.(v);
}

function conReintento(fn) {
  return fn().then(
    r => { marcar(false); return r; },
    e => {
      if (!esErrorDeRed(e)) throw e;
      marcar(true);
      return new Promise((resolve, reject) => cola.push({ fn, resolve, reject }));
    }
  );
}

addEventListener('online', async () => {
  if (!cola.length) return marcar(false);
  const pend = cola.splice(0, cola.length);
  for (const item of pend) {
    try { item.resolve(await item.fn()); }
    catch (e) { esErrorDeRed(e) ? cola.push(item) : item.reject(e); }
  }
  marcar(cola.length > 0);
});
