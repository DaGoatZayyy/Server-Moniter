-- ServerMonitor data model
-- Run this in a Supabase project after configuring your Auth0/Supabase integration.

create table if not exists public.servers (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  name text not null,
  host text not null,
  agent_id uuid unique not null default gen_random_uuid(),
  status text not null default 'offline' check (status in ('online','offline','warning')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.metrics (
  id bigint generated always as identity primary key,
  server_id uuid not null references public.servers(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  cpu_percent real,
  memory_percent real,
  gpu_percent real,
  disk_percent real,
  download_mbps real,
  upload_mbps real,
  uptime_seconds bigint
);

create table if not exists public.processes (
  id bigint generated always as identity primary key,
  server_id uuid not null references public.servers(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  pid integer,
  name text not null,
  cpu_percent real,
  memory_mb real
);

create table if not exists public.logs (
  id bigint generated always as identity primary key,
  server_id uuid not null references public.servers(id) on delete cascade,
  created_at timestamptz not null default now(),
  level text not null check (level in ('info','warn','error')),
  source text,
  message text not null
);

create table if not exists public.errors (
  id bigint generated always as identity primary key,
  server_id uuid not null references public.servers(id) on delete cascade,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  severity text not null default 'error',
  code text,
  message text not null
);

create index if not exists metrics_server_time_idx on public.metrics(server_id, recorded_at desc);
create index if not exists processes_server_time_idx on public.processes(server_id, recorded_at desc);
create index if not exists logs_server_time_idx on public.logs(server_id, created_at desc);
create index if not exists errors_server_time_idx on public.errors(server_id, created_at desc);

alter table public.servers enable row level security;
alter table public.metrics enable row level security;
alter table public.processes enable row level security;
alter table public.logs enable row level security;
alter table public.errors enable row level security;

-- Policies should be added after the Auth0 -> Supabase JWT claims are configured.
-- Keep the service-role key server-side only; never expose it in browser code.
