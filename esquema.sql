-- OGGI · esquema de base de datos
-- Pegar completo en Supabase → SQL Editor → Run.
-- Es seguro ejecutarlo más de una vez.

-- ---------------------------------------------------------------
-- Perfil (una fila por usuario, se crea sola al registrarse)
-- ---------------------------------------------------------------
create table if not exists perfiles (
  id uuid primary key references auth.users on delete cascade,
  nombre text,
  dinero_base numeric default 0,
  meta_ahorro numeric default 0,
  creado_en timestamptz default now()
);

create or replace function crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, nombre) values (new.id, new.raw_user_meta_data->>'nombre')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function crear_perfil();

-- ---------------------------------------------------------------
-- Notas adhesivas
-- ---------------------------------------------------------------
create table if not exists notas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  texto text default '',
  color smallint default 0,          -- 0-5, índice de la paleta pastel
  fuente smallint default 1,         -- 0 Montserrat, 1 Caveat, 2 Space Mono
  x real, y real, z int default 1,   -- posición en el tablero (null = auto)
  trazos jsonb default '[]'::jsonb,  -- [{ id, color, pts }]
  actualizado_en timestamptz default now()
);

-- ---------------------------------------------------------------
-- Eventos del calendario
-- ---------------------------------------------------------------
create table if not exists eventos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  titulo text not null,
  fecha date not null,
  hora smallint,                     -- 0-23, null = "sin hora"
  color smallint default 2,
  actualizado_en timestamptz default now()
);
create index if not exists eventos_user_fecha on eventos (user_id, fecha);

-- ---------------------------------------------------------------
-- Tareas
-- ---------------------------------------------------------------
create table if not exists tareas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  texto text not null,
  hecha boolean default false,
  etiqueta text default 'Personal',
  creado_en timestamptz default now()
);
create index if not exists tareas_user on tareas (user_id, creado_en desc);

-- ---------------------------------------------------------------
-- Proyectos, pasos y notas de proyecto
-- ---------------------------------------------------------------
create table if not exists proyectos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null,
  color smallint default 0,
  etiqueta text default 'Personal',
  descripcion text default '',
  vence date,
  creado_en timestamptz default now()
);

create table if not exists proyecto_pasos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  proyecto_id uuid not null references proyectos on delete cascade,
  texto text not null,
  hecho boolean default false,
  orden int default 0
);
create index if not exists pasos_proyecto on proyecto_pasos (proyecto_id, orden);

create table if not exists proyecto_notas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  proyecto_id uuid not null references proyectos on delete cascade,
  texto text not null,
  color smallint default 0,
  creado_en timestamptz default now()
);
create index if not exists notas_proyecto on proyecto_notas (proyecto_id);

-- ---------------------------------------------------------------
-- Hábitos
-- ---------------------------------------------------------------
create table if not exists habitos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null,
  color smallint default 0,
  creado_en timestamptz default now()
);

create table if not exists habito_marcas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  habito_id uuid not null references habitos on delete cascade,
  fecha date not null,
  unique (habito_id, fecha)
);
create index if not exists marcas_habito on habito_marcas (habito_id, fecha desc);

-- ---------------------------------------------------------------
-- Dinero
-- ---------------------------------------------------------------
create table if not exists gastos_fijos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null,
  monto numeric default 0,
  color smallint default 0,
  creado_en timestamptz default now()
);

create table if not exists gastos_fijos_pagos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  gasto_id uuid not null references gastos_fijos on delete cascade,
  mes text not null,                 -- 'YYYY-MM'
  unique (gasto_id, mes)
);

create table if not exists gastos_variables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null,
  monto numeric default 0,
  categoria text default 'Otros',
  fecha date not null default current_date
);
create index if not exists variables_user_fecha on gastos_variables (user_id, fecha desc);

create table if not exists ingresos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  origen text not null,
  detalle text default '',
  monto numeric default 0,
  fecha date not null default current_date
);
create index if not exists ingresos_user_fecha on ingresos (user_id, fecha desc);

create table if not exists ahorros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null default 'Aporte',
  monto numeric default 0,
  fecha date not null default current_date
);
create index if not exists ahorros_user_fecha on ahorros (user_id, fecha desc);

-- ---------------------------------------------------------------
-- Dinero por mes: cada mes tiene su propio dinero base, meta de ahorro
-- y lista de gastos fijos. Los meses anteriores quedan como estaban.
-- ---------------------------------------------------------------
create table if not exists dinero_mensual (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  mes text not null,                 -- 'YYYY-MM'
  dinero_base numeric default 0,
  meta_ahorro numeric default 0,
  unique (user_id, mes)
);

-- El dinero base y la meta que ya estaban cargados pasan a septiembre 2026
-- (el mes en que se usaron). Si ya existe la fila, no se toca.
insert into dinero_mensual (user_id, mes, dinero_base, meta_ahorro)
select id, '2026-09', coalesce(dinero_base, 0), coalesce(meta_ahorro, 0)
from perfiles
where coalesce(dinero_base, 0) <> 0 or coalesce(meta_ahorro, 0) <> 0
on conflict (user_id, mes) do nothing;

-- Cada gasto fijo pertenece a un mes. Los que ya existían quedan en el mes
-- en que se crearon (hora de Argentina), así septiembre conserva los suyos.
alter table gastos_fijos add column if not exists mes text;
update gastos_fijos
set mes = to_char(creado_en at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM')
where mes is null;
create index if not exists fijos_user_mes on gastos_fijos (user_id, mes);

-- ---------------------------------------------------------------
-- Notas de texto (pestaña "Notas"): texto libre y largo, como la app de
-- notas del celular. La primera línea hace de título. Son distintas de
-- las notas adhesivas del Inicio (tabla "notas").
-- ---------------------------------------------------------------
create table if not exists apuntes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  texto text default '',
  creado_en timestamptz default now(),
  actualizado_en timestamptz default now()
);
create index if not exists apuntes_user on apuntes (user_id, actualizado_en desc);

-- ---------------------------------------------------------------
-- Seguridad: cada persona solo ve y toca SUS filas.
-- Esta parte es la que hace que OGGI sea multicliente de verdad.
-- ---------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'perfiles','notas','eventos','tareas','proyectos','proyecto_pasos','proyecto_notas',
    'habitos','habito_marcas','gastos_fijos','gastos_fijos_pagos','gastos_variables',
    'ingresos','ahorros','dinero_mensual','apuntes'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "propio" on %I', t);
    if t = 'perfiles' then
      execute format('create policy "propio" on %I for all using (id = auth.uid()) with check (id = auth.uid())', t);
    else
      execute format('create policy "propio" on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    end if;
  end loop;
end $$;

-- Avisa a la API de Supabase que hay tablas nuevas, para que la app las vea
-- enseguida sin esperar.
notify pgrst, 'reload schema';
