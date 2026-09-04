// Edge Function: borra la cuenta del usuario que llama (correo, contraseña y
// sesión). Necesita la service_role key porque auth.admin.deleteUser no está
// permitido con la anon key. El "on delete cascade" del esquema.sql se
// encarga de borrar el resto de sus filas (notas, eventos, tareas, etc.).
//
// Desplegar con: supabase functions deploy borrar-cuenta
// No hace falta configurar nada más: SUPABASE_URL, SUPABASE_ANON_KEY y
// SUPABASE_SERVICE_ROLE_KEY ya están disponibles como variables de entorno
// dentro de cualquier Edge Function del proyecto.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Falta el token de autenticación.' }, 401);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Este cliente solo sirve para identificar quién llama, con su propio token.
  const comoUsuario = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: errUsuario } = await comoUsuario.auth.getUser();
  if (errUsuario || !user) return json({ error: 'Sesión inválida o vencida.' }, 401);

  // Este cliente, con service_role, es el único que puede borrar cuentas.
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
});
