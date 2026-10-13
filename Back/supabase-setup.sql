-- Ejecuta en SQL Editor de un proyecto Supabase nuevo.
begin;
create table if not exists public.entregas (
 id text primary key,
 participante text not null check (participante ~ '^[A-Za-z0-9_-]{1,40}$'),
 tema text not null check (length(tema) between 1 and 150),
 inicio timestamptz not null,
 entrega timestamptz not null,
 duracion_segundos integer not null check (duracion_segundos >= 0),
 archivo text unique not null
);
create index if not exists entregas_fecha on public.entregas (entrega desc);
create table if not exists public.sesiones_admin (
 token text primary key,
 vence bigint not null,
 credencial text not null
);
alter table public.entregas enable row level security;
alter table public.sesiones_admin enable row level security;
revoke all on public.entregas, public.sesiones_admin from anon, authenticated;
grant all on public.entregas, public.sesiones_admin to service_role;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('posters', 'posters', false, 8388608, array['image/png'])
on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = array['image/png'];
commit;
-- No crees políticas públicas para estas tablas ni para el bucket.
