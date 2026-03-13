create extension if not exists pgcrypto;

create schema if not exists app;

create type public.location_type as enum ('pickup', 'return', 'mixed', 'warehouse');
create type public.staff_role as enum ('scanner', 'location_manager', 'admin');
create type public.pickup_target_type as enum ('order', 'line_item', 'ticket', 'tree_claim');
create type public.pickup_status as enum ('ready', 'blocked', 'picked_up', 'reversed', 'expired');
create type public.payment_status as enum ('paid', 'partially_paid', 'pending', 'authorized', 'refunded', 'voided', 'unpaid');
create type public.eligibility_status as enum ('valid', 'not_found', 'cancelled', 'unpaid', 'wrong_location', 'already_picked_up', 'manual_review');
create type public.pickup_event_type as enum ('scan_attempt', 'validated', 'rejected', 'pickup_confirmed', 'pickup_reversed', 'manual_override');
create type public.pickup_event_result as enum ('success', 'not_found', 'already_picked_up', 'cancelled', 'unpaid', 'wrong_location', 'invalid_qr', 'error');
create type public.override_target_type as enum ('project', 'location', 'order', 'order_item', 'pickup_target', 'pickup_event', 'tree', 'return_event');
create type public.sync_job_type as enum ('webhook_ingest', 'order_pull', 'order_pushback');
create type public.sync_job_status as enum ('pending', 'processing', 'completed', 'failed', 'cancelled');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  code text not null unique,
  is_active boolean not null default true,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint projects_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  name text not null,
  code text not null,
  type public.location_type not null,
  address_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, code)
);

create table public.staff_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  default_location_id uuid references public.locations(id) on delete set null,
  full_name text not null,
  email text not null,
  role public.staff_role not null,
  is_active boolean not null default true,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (email)
);

create or replace function app.current_staff_role()
returns public.staff_role
language sql
stable
as $$
  select sp.role
  from public.staff_profiles sp
  where sp.id = auth.uid()
    and sp.is_active = true
  limit 1
$$;

create or replace function app.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(app.current_staff_role() = 'admin', false)
$$;

create or replace function app.is_active_staff()
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.staff_profiles sp
    where sp.id = auth.uid()
      and sp.is_active = true
  )
$$;

create table public.shopify_customers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  shopify_customer_id text not null unique,
  email text,
  first_name text,
  last_name text,
  phone text,
  default_address_json jsonb not null default '{}'::jsonb,
  synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.shopify_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  customer_id uuid references public.shopify_customers(id) on delete set null,
  shopify_order_id text not null unique,
  shopify_order_number text,
  shopify_name text,
  currency text,
  financial_status text,
  fulfillment_status text,
  cancelled_at timestamptz,
  closed_at timestamptz,
  order_created_at timestamptz,
  order_updated_at timestamptz,
  tags text[] not null default '{}',
  note text,
  raw_snapshot jsonb not null default '{}'::jsonb,
  synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.shopify_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shopify_orders(id) on delete cascade,
  shopify_line_item_id text not null unique,
  sku text,
  title text not null,
  variant_title text,
  quantity integer not null default 1,
  fulfillable_quantity integer not null default 0,
  product_type text,
  requires_shipping boolean not null default true,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint shopify_order_items_quantity_check check (quantity >= 0),
  constraint shopify_order_items_fulfillable_quantity_check check (fulfillable_quantity >= 0)
);

create table public.pickup_targets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  order_id uuid not null references public.shopify_orders(id) on delete cascade,
  order_item_id uuid references public.shopify_order_items(id) on delete set null,
  target_type public.pickup_target_type not null,
  qr_value text not null unique,
  intended_location_id uuid references public.locations(id) on delete set null,
  pickup_status public.pickup_status not null default 'ready',
  payment_status public.payment_status not null default 'unpaid',
  eligibility_status public.eligibility_status not null default 'manual_review',
  issued_at timestamptz,
  issued_by uuid references public.staff_profiles(id) on delete set null,
  last_event_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.pickup_events (
  id uuid primary key default gen_random_uuid(),
  pickup_target_id uuid not null references public.pickup_targets(id) on delete cascade,
  event_type public.pickup_event_type not null,
  result public.pickup_event_result not null,
  staff_user_id uuid references public.staff_profiles(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  device_label text,
  qr_value text not null,
  notes text,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.pickup_targets
  add constraint pickup_targets_last_event_id_fkey
  foreign key (last_event_id)
  references public.pickup_events(id)
  on delete set null;

create table public.admin_overrides (
  id uuid primary key default gen_random_uuid(),
  target_type public.override_target_type not null,
  target_id uuid not null,
  action_type text not null,
  old_value jsonb not null default '{}'::jsonb,
  new_value jsonb not null default '{}'::jsonb,
  reason text not null,
  performed_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.staff_profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  ip inet,
  user_agent text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  job_type public.sync_job_type not null,
  entity_type text not null,
  entity_external_id text,
  status public.sync_job_status not null default 'pending',
  attempt_count integer not null default 0,
  last_error text,
  scheduled_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint sync_jobs_attempt_count_check check (attempt_count >= 0)
);

create index projects_code_idx on public.projects (code);

create index locations_project_id_idx on public.locations (project_id);
create index locations_project_type_idx on public.locations (project_id, type);

create index staff_profiles_project_id_idx on public.staff_profiles (project_id);
create index staff_profiles_default_location_id_idx on public.staff_profiles (default_location_id);
create index staff_profiles_role_idx on public.staff_profiles (role);

create index shopify_customers_project_id_idx on public.shopify_customers (project_id);
create index shopify_customers_email_idx on public.shopify_customers (email);

create index shopify_orders_project_id_idx on public.shopify_orders (project_id);
create index shopify_orders_customer_id_idx on public.shopify_orders (customer_id);
create index shopify_orders_shopify_order_number_idx on public.shopify_orders (shopify_order_number);
create index shopify_orders_shopify_name_idx on public.shopify_orders (shopify_name);
create index shopify_orders_order_created_at_idx on public.shopify_orders (order_created_at desc);

create index shopify_order_items_order_id_idx on public.shopify_order_items (order_id);
create index shopify_order_items_sku_idx on public.shopify_order_items (sku);

create index pickup_targets_project_id_idx on public.pickup_targets (project_id);
create index pickup_targets_order_id_idx on public.pickup_targets (order_id);
create index pickup_targets_order_item_id_idx on public.pickup_targets (order_item_id);
create index pickup_targets_intended_location_id_idx on public.pickup_targets (intended_location_id);
create index pickup_targets_pickup_status_idx on public.pickup_targets (pickup_status);
create index pickup_targets_payment_status_idx on public.pickup_targets (payment_status);
create index pickup_targets_eligibility_status_idx on public.pickup_targets (eligibility_status);

create index pickup_events_pickup_target_id_idx on public.pickup_events (pickup_target_id, created_at desc);
create index pickup_events_staff_user_id_idx on public.pickup_events (staff_user_id, created_at desc);
create index pickup_events_location_id_idx on public.pickup_events (location_id, created_at desc);
create index pickup_events_qr_value_idx on public.pickup_events (qr_value);

create index admin_overrides_target_idx on public.admin_overrides (target_type, target_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_user_id, created_at desc);
create index sync_jobs_project_status_idx on public.sync_jobs (project_id, status, scheduled_at);
create index sync_jobs_entity_external_id_idx on public.sync_jobs (entity_external_id);

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger locations_set_updated_at
before update on public.locations
for each row execute function public.set_updated_at();

create trigger staff_profiles_set_updated_at
before update on public.staff_profiles
for each row execute function public.set_updated_at();

create trigger shopify_customers_set_updated_at
before update on public.shopify_customers
for each row execute function public.set_updated_at();

create trigger shopify_orders_set_updated_at
before update on public.shopify_orders
for each row execute function public.set_updated_at();

create trigger shopify_order_items_set_updated_at
before update on public.shopify_order_items
for each row execute function public.set_updated_at();

create trigger pickup_targets_set_updated_at
before update on public.pickup_targets
for each row execute function public.set_updated_at();

create trigger sync_jobs_set_updated_at
before update on public.sync_jobs
for each row execute function public.set_updated_at();

alter table public.projects enable row level security;
alter table public.locations enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.shopify_customers enable row level security;
alter table public.shopify_orders enable row level security;
alter table public.shopify_order_items enable row level security;
alter table public.pickup_targets enable row level security;
alter table public.pickup_events enable row level security;
alter table public.admin_overrides enable row level security;
alter table public.audit_logs enable row level security;
alter table public.sync_jobs enable row level security;

create policy "staff_profiles_self_select"
on public.staff_profiles
for select
to authenticated
using (id = auth.uid());

create policy "staff_profiles_admin_select"
on public.staff_profiles
for select
to authenticated
using (app.is_admin());

create policy "projects_staff_select"
on public.projects
for select
to authenticated
using (app.is_active_staff());

create policy "locations_staff_select"
on public.locations
for select
to authenticated
using (app.is_active_staff());

create policy "shopify_customers_staff_select"
on public.shopify_customers
for select
to authenticated
using (app.is_active_staff());

create policy "shopify_orders_staff_select"
on public.shopify_orders
for select
to authenticated
using (app.is_active_staff());

create policy "shopify_order_items_staff_select"
on public.shopify_order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.shopify_orders so
    where so.id = shopify_order_items.order_id
      and app.is_active_staff()
  )
);

create policy "pickup_targets_staff_select"
on public.pickup_targets
for select
to authenticated
using (app.is_active_staff());

create policy "pickup_events_staff_select"
on public.pickup_events
for select
to authenticated
using (app.is_active_staff());

create policy "admin_overrides_admin_select"
on public.admin_overrides
for select
to authenticated
using (app.is_admin());

create policy "audit_logs_admin_select"
on public.audit_logs
for select
to authenticated
using (app.is_admin());

create policy "sync_jobs_admin_select"
on public.sync_jobs
for select
to authenticated
using (app.is_admin());
