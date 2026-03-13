-- ============================================================
-- Migratie: Distributor Voorraadbeheer
-- Vervangt de Google Sheets / teller-2000.js workflow
--
-- Relaties:
--   distributors        → projects (FK)
--   inventory_lines     → distributors × seasons (UNIQUE per combo)
--   inventory_adjustments → inventory_lines (flexibele aanpassingen)
-- ============================================================

-- ── 1. Distributeurs ────────────────────────────────────────
-- Hoofdleveranciers die bomen leveren en pickup-locaties aanvullen.
-- Verschilt van 'locations' (= ophaalplaatsen voor klanten).

create table public.distributors (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete restrict,
  name          text not null,
  code          text,                    -- bijv. "plansum", "groen-direct"
  contact_name  text,
  contact_email text,
  notes         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now()),
  unique (project_id, code)
);

create index distributors_project_id_idx on public.distributors(project_id);

create trigger set_distributors_updated_at
  before update on public.distributors
  for each row execute function public.set_updated_at();

-- ── 2. Voorraadregels ────────────────────────────────────────
-- Één rij per distributor × seizoen × boomcategorie.
-- 'category_code' = het type boom + maat, bijv. "MET-100-125".
-- Komt overeen met de rijen in de Google Sheet per distributeur.

create table public.inventory_lines (
  id              uuid primary key default gen_random_uuid(),
  distributor_id  uuid not null references public.distributors(id) on delete cascade,
  season_id       uuid not null references public.seasons(id) on delete cascade,
  category_code   text not null,   -- bijv. "MET-100-125", "ZONDER-150-175"
  display_label   text,            -- bijv. "100–125 cm / Met kluit"
  voorraad        integer not null default 0 check (voorraad >= 0),
  ingekocht       integer not null default 0,  -- mag negatief zijn (correctie)
  notes           text,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now()),
  unique (distributor_id, season_id, category_code)
);

create index inventory_lines_distributor_season_idx
  on public.inventory_lines(distributor_id, season_id);
create index inventory_lines_season_idx
  on public.inventory_lines(season_id);

create trigger set_inventory_lines_updated_at
  before update on public.inventory_lines
  for each row execute function public.set_updated_at();

-- ── 3. Aanpassingen ─────────────────────────────────────────
-- Flexibele extra kolommen per voorraadregel:
--   INFLUENCER ACTIE, EXTRA GOUDA, NALEVERING, etc.
-- positief  = extra voorraad ontvangen
-- negatief  = uitgegeven / gereserveerd
-- Aanpassingen zijn immutable: voeg nieuwe toe i.p.v. te wijzigen.

create table public.inventory_adjustments (
  id                uuid primary key default gen_random_uuid(),
  inventory_line_id uuid not null references public.inventory_lines(id) on delete cascade,
  label             text not null,    -- bijv. "INFLUENCER ACTIE", "EXTRA GOUDA"
  quantity          integer not null, -- positief = ontvangen, negatief = uitgegeven
  notes             text,
  created_at        timestamptz not null default timezone('utc', now())
  -- geen updated_at: aanpassingen zijn immutable
);

create index inventory_adjustments_line_idx
  on public.inventory_adjustments(inventory_line_id);

-- ── 4. RLS ───────────────────────────────────────────────────
alter table public.distributors          enable row level security;
alter table public.inventory_lines       enable row level security;
alter table public.inventory_adjustments enable row level security;

-- Admins: volledige toegang
create policy "Admin full access: distributors"
  on public.distributors for all
  using (app.is_admin())
  with check (app.is_admin());

create policy "Admin full access: inventory_lines"
  on public.inventory_lines for all
  using (app.is_admin())
  with check (app.is_admin());

create policy "Admin full access: inventory_adjustments"
  on public.inventory_adjustments for all
  using (app.is_admin())
  with check (app.is_admin());

-- Staff: alleen lezen
create policy "Staff read: distributors"
  on public.distributors for select
  using (app.is_active_staff());

create policy "Staff read: inventory_lines"
  on public.inventory_lines for select
  using (app.is_active_staff());

create policy "Staff read: inventory_adjustments"
  on public.inventory_adjustments for select
  using (app.is_active_staff());
