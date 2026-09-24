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
  senalador smallint,                -- 0-3, índice de forma (null = sin señalador)
  actualizado_en timestamptz default now()
);
alter table notas add column if not exists senalador smallint;

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
  monto numeric default 0,           -- solo aplica si precio_fijo = true
  precio_fijo boolean not null default true,
  categoria text default 'Otros',
  color smallint default 0,
  creado_en timestamptz default now()
);
alter table gastos_fijos add column if not exists precio_fijo boolean not null default true;
alter table gastos_fijos add column if not exists categoria text default 'Otros';

create table if not exists gastos_fijos_pagos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  gasto_id uuid not null references gastos_fijos on delete cascade,
  mes text not null,                 -- 'YYYY-MM'
  monto numeric,                     -- monto real pagado, solo si el gasto es de precio variable
  unique (gasto_id, mes)
);
alter table gastos_fijos_pagos add column if not exists monto numeric;

-- Dinero base y meta de ahorro, ahora por mes (antes eran un único valor
-- por cuenta, así que arrastraban el mismo número a todos los meses).
create table if not exists dinero_mensual (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  mes text not null,                 -- 'YYYY-MM'
  dinero_base numeric default 0,
  meta_ahorro numeric default 0,
  unique (user_id, mes)
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

-- Ahorro programado: como gastos_fijos pero al revés (un monto mensual que
-- se planea ahorrar, con un check de "cumplido este mes" separado).
create table if not exists ahorros_programados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null,
  monto numeric default 0,
  color smallint default 0,
  creado_en timestamptz default now()
);

create table if not exists ahorros_programados_pagos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  ahorro_id uuid not null references ahorros_programados on delete cascade,
  mes text not null,                 -- 'YYYY-MM'
  unique (ahorro_id, mes)
);

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
    'ingresos','ahorros','ahorros_programados','ahorros_programados_pagos','dinero_mensual'
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
