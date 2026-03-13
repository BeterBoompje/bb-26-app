create type public.source_system as enum ('shopify', 'manual', 'external');

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  code text not null,
  year integer not null,
  label text not null,
  source_system public.source_system not null default 'manual',
  order_prefix text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, code),
  unique (project_id, year),
  constraint seasons_year_check check (year >= 2000 and year <= 2100)
);

create trigger seasons_set_updated_at
before update on public.seasons
for each row execute function public.set_updated_at();

create index seasons_project_id_idx on public.seasons (project_id, year desc);
create index seasons_source_system_idx on public.seasons (source_system);

alter table public.seasons enable row level security;

create policy "seasons_project_select"
on public.seasons
for select
to authenticated
using (app.user_has_project_access(project_id));

alter table public.shopify_orders
  add column if not exists season_id uuid references public.seasons(id) on delete set null;

alter table public.pickup_targets
  add column if not exists season_id uuid references public.seasons(id) on delete set null;

alter table public.sync_jobs
  add column if not exists season_id uuid references public.seasons(id) on delete set null;

create index shopify_orders_season_id_idx on public.shopify_orders (season_id);
create index pickup_targets_season_id_idx on public.pickup_targets (season_id);
create index sync_jobs_season_id_idx on public.sync_jobs (season_id);
