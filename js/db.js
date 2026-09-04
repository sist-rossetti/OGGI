// Capa de datos: todo lo que habla con Supabase pasa por acá.
// El resto de la app no sabe que Supabase existe.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const TABLAS = [
  'notas', 'eventos', 'tareas', 'proyectos', 'proyecto_pasos', 'proyecto_notas',
  'habitos', 'habito_marcas', 'gastos_fijos', 'gastos_fijos_pagos',
  'gastos_variables', 'ingresos', 'ahorros'
];

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

/* ---------- perfil ---------- */

export async function leerPerfil() {
  const { data, error } = await sb.from('perfiles').select('*').maybeSingle();
  if (error) throw error;
  return data || { dinero_base: 0, meta_ahorro: 0 };
}

export async function guardarPerfil(campos) {
  const { data: { user } } = await sb.auth.getUser();
  const { error } = await sb.from('perfiles').upsert({ id: user.id, ...campos });
  if (error) throw error;
}

/* ---------- CRUD genérico ---------- */

export async function traerTodo() {
  const out = {};
  await Promise.all(TABLAS.map(async t => {
    const { data, error } = await sb.from(t).select('*');
    if (error) throw error;
    out[t] = data || [];
  }));
  out.perfil = await leerPerfil();
  return out;
}

export async function crear(tabla, fila) {
  const { data, error } = await sb.from(tabla).insert(fila).select().single();
  if (error) throw error;
  return data;
}

export async function actualizar(tabla, id, campos) {
  const { error } = await sb.from(tabla).update(campos).eq('id', id);
  if (error) throw error;
}

export async function borrar(tabla, id) {
  const { error } = await sb.from(tabla).delete().eq('id', id);
  if (error) throw error;
}

export async function borrarDonde(tabla, filtro) {
  let q = sb.from(tabla).delete();
  Object.entries(filtro).forEach(([k, v]) => { q = q.eq(k, v); });
  const { error } = await q;
  if (error) throw error;
}

/* ---------- importar un respaldo (el JSON que genera "Exportar") ---------- */

// Orden que respeta las referencias entre tablas (padres antes que hijos).
const ORDEN_IMPORT = [
  'notas', 'eventos', 'tareas', 'proyectos', 'proyecto_pasos', 'proyecto_notas',
  'habitos', 'habito_marcas', 'gastos_fijos', 'gastos_fijos_pagos',
  'gastos_variables', 'ingresos', 'ahorros'
];
// Tablas "padre": borrarlas alcanza, porque el resto cuelga de ellas con
// "on delete cascade" (ver esquema.sql).
const TABLAS_PADRE = ['notas', 'eventos', 'tareas', 'proyectos', 'habitos', 'gastos_fijos', 'gastos_variables', 'ingresos', 'ahorros'];

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
    const { error } = await sb.from(t).upsert(limpio, { onConflict: 'id' });
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
