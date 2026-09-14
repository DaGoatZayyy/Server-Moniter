-- ServerMonitor data model
create table if not exists public.servers (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  name text not null,
  host text not null,
  os text not null default 'windows',
  collection_interval integer not null default 5,
  agent_id uuid unique not null default gen_random_uuid(),
  agent_secret_hash text not null,
  status text not null default 'offline' check (status in ('online','offline','warning')),
  last_seen_at timestamptz,
  system_info jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.metrics (
  id bigint generated always as identity primary key, server_id uuid not null references public.servers(id) on delete cascade,
  recorded_at timestamptz not null default now(), cpu_percent real, memory_percent real, gpu_percent real, disk_percent real,
  download_mbps real, upload_mbps real, uptime_seconds bigint
);
create table if not exists public.processes (
  id bigint generated always as identity primary key, server_id uuid not null references public.servers(id) on delete cascade,
  recorded_at timestamptz not null default now(), pid integer, name text not null, cpu_percent real, memory_mb real
);
create table if not exists public.logs (
  id bigint generated always as identity primary key, server_id uuid not null references public.servers(id) on delete cascade,
  created_at timestamptz not null default now(), level text not null check (level in ('info','warn','error')), source text, message text not null
);
create table if not exists public.errors (
  id bigint generated always as identity primary key, server_id uuid not null references public.servers(id) on delete cascade,
  created_at timestamptz not null default now(), resolved_at timestamptz, severity text not null default 'error', code text, message text not null
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

-- Migration safety for databases created from an earlier schema.
alter table public.servers add column if not exists os text not null default 'windows';
alter table public.servers add column if not exists collection_interval integer not null default 5;
alter table public.servers add column if not exists agent_secret_hash text;
alter table public.servers add column if not exists system_info jsonb;
-- The service role is server-side only. Add owner-scoped policies after configuring Auth0 JWT claims.
