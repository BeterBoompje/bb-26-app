# Supabase

Dit is de eerste Supabase v1 basis voor de nieuwe BB/AEK app.

## Doel

Deze setup richt zich eerst op de operationele kern:

- projecten
- locaties
- staff-profielen
- Shopify cache
- pickup targets
- pickup events
- audit en overrides

## Structuur

- `migrations/` bevat SQL migraties

## Scope van v1

Deze eerste migratie zet neer:

- enums
- kern-tabellen
- foreign keys en indexes
- `updated_at` trigger
- RLS baseline

De tweede migratie voegt operationele hardening toe:

- projectmemberships voor multi-project toegang
- project-gefilterde RLS policies
- sync observability en discrepancy velden
- `product_variants` voor kleur- en variantmapping
- `confirm_pickup()` RPC met statusguards
- `admin_sync_health` en `location_readiness` views

## Belangrijke aanname

Voor de eerste versie gaan we ervan uit dat:

- Supabase Auth de identity-laag is
- Astro server routes de gevoelige mutaties doen
- RLS al aan staat, maar dat we complexere locatie- en rolpolicies in een volgende stap verfijnen

Dat houdt de basis veilig zonder de eerste bouwstappen onnodig te blokkeren.

## Belangrijke ontwerpkeuzes

- Multi-project zit in de basis, zodat BB en AEK in hetzelfde platform passen.
- Pickup-eligibility wordt live bepaald in een functie, niet alleen vertrouwd op een gecachte statuskolom.
- Shopify sync moet observable zijn; discrepanties moeten in de database zichtbaar worden.
