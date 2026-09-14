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
  agent_version text,
  created_at timestamptz not null default now()
);

create table if not exists public.server_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique(owner_id, name)
);
create table if not exists public.server_group_members (
  group_id uuid not null references public.server_groups(id) on delete cascade,
  server_id uuid not null references public.servers(id) on delete cascade,
  primary key(group_id, server_id)
);

create table if not exists public.profiles (
  owner_id text primary key,
  username text,
  display_name text,
  bio text,
  avatar_url text,
  is_public boolean not null default false,
  github_username text,
  github_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.metrics (
  id bigint generated always as identity primary key, server_id uuid not null references public.servers(id) on delete cascade,
  recorded_at timestamptz not null default now(), cpu_percent real, memory_percent real, gpu_percent real, disk_percent real,
  download_mbps real, upload_mbps real, uptime_seconds bigint,
  network_interfaces jsonb,
  disk_details jsonb
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
create table if not exists public.alert_history (
  id bigint generated always as identity primary key,
  server_id uuid not null references public.servers(id) on delete cascade,
  code text not null,
  severity text not null,
  message text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create table if not exists public.agent_cursors (
  server_id uuid primary key references public.servers(id) on delete cascade,
  windows_system_record_id bigint,
  windows_application_record_id bigint,
  linux_journal_cursor text,
  updated_at timestamptz not null default now()
);

create index if not exists metrics_server_time_idx on public.metrics(server_id, recorded_at desc);
create index if not exists processes_server_time_idx on public.processes(server_id, recorded_at desc);
create index if not exists logs_server_time_idx on public.logs(server_id, created_at desc);
create index if not exists errors_server_time_idx on public.errors(server_id, created_at desc);
create index if not exists alerts_server_time_idx on public.alert_history(server_id, started_at desc);

alter table public.servers enable row level security;
alter table public.server_groups enable row level security;
alter table public.server_group_members enable row level security;
alter table public.profiles enable row level security;
alter table public.metrics enable row level security;
alter table public.processes enable row level security;
alter table public.logs enable row level security;
alter table public.errors enable row level security;
alter table public.alert_history enable row level security;
alter table public.agent_cursors enable row level security;

-- Migration safety for databases created from an earlier schema.
alter table public.servers add column if not exists os text not null default 'windows';
alter table public.servers add column if not exists collection_interval integer not null default 5;
alter table public.servers add column if not exists agent_secret_hash text;
alter table public.servers add column if not exists system_info jsonb;
alter table public.servers add column if not exists agent_version text;
alter table public.metrics add column if not exists network_interfaces jsonb;
alter table public.metrics add column if not exists disk_details jsonb;
-- The service role is server-side only. Add owner-scoped policies after configuring Auth0 JWT claims.
