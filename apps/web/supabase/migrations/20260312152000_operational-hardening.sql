create table public.project_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  role public.staff_role not null,
  default_location_id uuid references public.locations(id) on delete set null,
  is_active boolean not null default true,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, project_id)
);

create trigger project_memberships_set_updated_at
before update on public.project_memberships
for each row execute function public.set_updated_at();

create index project_memberships_user_id_idx on public.project_memberships (user_id);
create index project_memberships_project_id_idx on public.project_memberships (project_id);
create index project_memberships_role_idx on public.project_memberships (role);

alter table public.project_memberships enable row level security;

create or replace function app.user_has_project_access(p_project_id uuid)
returns boolean
language sql
stable
as $$
  select
    app.is_admin()
    or exists (
      select 1
      from public.project_memberships pm
      where pm.user_id = auth.uid()
        and pm.project_id = p_project_id
        and pm.is_active = true
    )
$$;

create or replace function app.user_has_location_access(p_location_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.locations l
    where l.id = p_location_id
      and app.user_has_project_access(l.project_id)
  )
$$;

create policy "project_memberships_self_select"
on public.project_memberships
for select
to authenticated
using (user_id = auth.uid() or app.is_admin());

drop policy "projects_staff_select" on public.projects;
drop policy "locations_staff_select" on public.locations;
drop policy "shopify_customers_staff_select" on public.shopify_customers;
drop policy "shopify_orders_staff_select" on public.shopify_orders;
drop policy "shopify_order_items_staff_select" on public.shopify_order_items;
drop policy "pickup_targets_staff_select" on public.pickup_targets;
drop policy "pickup_events_staff_select" on public.pickup_events;

create policy "projects_project_select"
on public.projects
for select
to authenticated
using (app.user_has_project_access(id));

create policy "locations_project_select"
on public.locations
for select
to authenticated
using (app.user_has_project_access(project_id));

create policy "shopify_customers_project_select"
on public.shopify_customers
for select
to authenticated
using (app.user_has_project_access(project_id));

create policy "shopify_orders_project_select"
on public.shopify_orders
for select
to authenticated
using (app.user_has_project_access(project_id));

create policy "shopify_order_items_project_select"
on public.shopify_order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.shopify_orders so
    where so.id = shopify_order_items.order_id
      and app.user_has_project_access(so.project_id)
  )
);

create policy "pickup_targets_project_select"
on public.pickup_targets
for select
to authenticated
using (app.user_has_project_access(project_id));

create policy "pickup_events_project_select"
on public.pickup_events
for select
to authenticated
using (
  exists (
    select 1
    from public.pickup_targets pt
    where pt.id = pickup_events.pickup_target_id
      and app.user_has_project_access(pt.project_id)
  )
);

alter type public.sync_job_status add value if not exists 'needs_review';

alter table public.sync_jobs
  add column if not exists shopify_order_count integer,
  add column if not exists processed_count integer not null default 0,
  add column if not exists failed_ids text[] not null default '{}',
  add column if not exists checksum_verified boolean not null default false,
  add column if not exists priority integer not null default 5,
  add column if not exists do_not_run_during_peak boolean not null default false,
  add column if not exists meta jsonb not null default '{}'::jsonb;

alter table public.sync_jobs
  add constraint sync_jobs_priority_check check (priority between 1 and 10);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  sku_pattern text not null,
  display_label text not null,
  color_hex text not null,
  color_name text not null,
  has_rootball boolean not null default false,
  size_from_cm integer,
  size_to_cm integer,
  sort_order integer not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger product_variants_set_updated_at
before update on public.product_variants
for each row execute function public.set_updated_at();

create index product_variants_project_id_idx on public.product_variants (project_id, sort_order);
create index product_variants_sku_pattern_idx on public.product_variants (sku_pattern);

alter table public.product_variants enable row level security;

create policy "product_variants_project_select"
on public.product_variants
for select
to authenticated
using (app.user_has_project_access(project_id));

create or replace function public.resolve_pickup_eligibility(
  p_pickup_target_id uuid,
  p_location_id uuid
)
returns table (
  eligibility public.eligibility_status,
  reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.pickup_targets;
  v_order public.shopify_orders;
begin
  select *
  into v_target
  from public.pickup_targets
  where id = p_pickup_target_id;

  if not found then
    return query select 'not_found'::public.eligibility_status, 'pickup_target_not_found'::text;
    return;
  end if;

  select *
  into v_order
  from public.shopify_orders
  where id = v_target.order_id;

  if not found then
    return query select 'not_found'::public.eligibility_status, 'order_not_found'::text;
    return;
  end if;

  if v_order.cancelled_at is not null then
    return query select 'cancelled'::public.eligibility_status, 'order_cancelled'::text;
    return;
  end if;

  if v_target.pickup_status = 'picked_up' then
    return query select 'already_picked_up'::public.eligibility_status, 'already_picked_up'::text;
    return;
  end if;

  if v_target.pickup_status <> 'ready' then
    return query select 'manual_review'::public.eligibility_status, 'pickup_status_not_ready'::text;
    return;
  end if;

  if v_target.payment_status not in ('paid', 'partially_paid', 'authorized') then
    return query select 'unpaid'::public.eligibility_status, 'payment_not_eligible'::text;
    return;
  end if;

  if v_target.intended_location_id is not null and v_target.intended_location_id <> p_location_id then
    return query select 'wrong_location'::public.eligibility_status, 'wrong_location'::text;
    return;
  end if;

  return query select 'valid'::public.eligibility_status, 'ok'::text;
end;
$$;

create or replace function public.confirm_pickup(
  p_pickup_target_id uuid,
  p_staff_user_id uuid,
  p_location_id uuid,
  p_device_label text default null,
  p_notes text default null
)
returns public.pickup_targets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.pickup_targets;
  v_event_id uuid;
  v_eligibility public.eligibility_status;
  v_reason text;
begin
  select *
  into v_target
  from public.pickup_targets
  where id = p_pickup_target_id
  for update;

  if not found then
    raise exception 'pickup_not_found';
  end if;

  select eligibility, reason
  into v_eligibility, v_reason
  from public.resolve_pickup_eligibility(p_pickup_target_id, p_location_id);

  if v_eligibility <> 'valid' then
    raise exception 'pickup_not_allowed: %', v_reason;
  end if;

  insert into public.pickup_events (
    pickup_target_id,
    event_type,
    result,
    staff_user_id,
    location_id,
    device_label,
    qr_value,
    notes,
    context,
    created_at
  ) values (
    p_pickup_target_id,
    'pickup_confirmed',
    'success',
    p_staff_user_id,
    p_location_id,
    p_device_label,
    v_target.qr_value,
    p_notes,
    jsonb_build_object('reason', v_reason),
    timezone('utc', now())
  )
  returning id into v_event_id;

  update public.pickup_targets
  set
    pickup_status = 'picked_up',
    eligibility_status = v_eligibility,
    issued_at = timezone('utc', now()),
    issued_by = p_staff_user_id,
    last_event_id = v_event_id,
    updated_at = timezone('utc', now())
  where id = p_pickup_target_id
  returning * into v_target;

  return v_target;
end;
$$;

create or replace view public.admin_sync_health as
select
  p.id as project_id,
  p.name as project_name,
  count(distinct so.id) as orders_in_supabase,
  max(so.synced_at) as last_synced,
  count(distinct so.id) filter (
    where so.synced_at is not null
      and so.synced_at < timezone('utc', now()) - interval '1 hour'
  ) as stale_orders,
  count(distinct pt.id) filter (where pt.pickup_status = 'picked_up') as picked_up,
  count(distinct pt.id) filter (where pt.pickup_status = 'ready') as ready_to_pickup,
  max(sj.shopify_order_count) filter (where sj.status::text in ('completed', 'needs_review')) as expected_from_shopify,
  max(sj.processed_count) filter (where sj.status::text in ('completed', 'needs_review')) as processed_in_last_sync,
  bool_or(sj.status::text = 'needs_review') as has_sync_issue
from public.projects p
left join public.shopify_orders so on so.project_id = p.id
left join public.pickup_targets pt on pt.project_id = p.id
left join public.sync_jobs sj on sj.project_id = p.id
group by p.id, p.name;

create or replace view public.location_readiness as
select
  l.id as location_id,
  l.name as location_name,
  l.code as location_code,
  p.id as project_id,
  p.name as project_name,
  count(pt.id) as total_targets,
  count(pt.id) filter (where pt.pickup_status = 'ready') as ready,
  count(pt.id) filter (where pt.pickup_status = 'picked_up') as picked_up,
  count(pt.id) filter (
    where (
      select r.eligibility
      from public.resolve_pickup_eligibility(pt.id, l.id) r
    ) = 'valid'
      and pt.pickup_status = 'ready'
  ) as valid_and_ready,
  max(so.synced_at) as last_order_synced
from public.locations l
join public.projects p on p.id = l.project_id
left join public.pickup_targets pt on pt.intended_location_id = l.id
left join public.shopify_orders so on so.id = pt.order_id
group by l.id, l.name, l.code, p.id, p.name;
