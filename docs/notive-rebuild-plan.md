# Notive Rebuild Plan

## Doel

Deze workspace bevat geen volledige oude broncode, maar wel genoeg artefacten om de oude operationele flow van de Notive/Beter Boompje portal te reconstrueren. Op basis daarvan kunnen we een nieuwe gecombineerde app voor BB en AEK ontwerpen op `Astro + Supabase`, met Claude als bouwassistent.

De richting is:

- 1 operationeel systeem voor BB en AEK
- scannerflow + beheer in dezelfde app
- Shopify als commercebron
- Supabase als operationele bron voor scan, locatie, events en audit
- Client-First als basis voor HTML- en CSS-opbouw
- oude Notive/Laravel/Livewire implementatie niet kopieren, alleen de domeinlogica meenemen

## Wat er in `references/notive-app-scrap` aantoonbaar aanwezig is

### Oude stack

De oude portal draaide op:

- Laravel
- Filament
- Livewire
- Alpine
- `html5-qrcode`

Dat blijkt uit onder meer:

- `Orders - Beter Boompje.html`
- `Dashboard - Beter Boompje.html`
- `Html notive/Scan Tree - Beter Boompje.html`
- diverse HAR-bestanden met `admin/...` en `app/...` routes

### Twee panelen

Er waren functioneel twee panelen:

- `admin/*` voor beheer
- `app/{location-slug}/*` voor operationeel gebruik op locatie

Gevonden routes:

- `admin/users`
- `admin/users/{id}/edit`
- `admin/locations`
- `admin/locations/{id}/edit`
- `app/{location}/`
- `app/{location}/scan-tree`
- `app/{location}/orders`
- `app/{location}/orders/{id}/pickup`

### Locatiegebonden operatie

De oude app was expliciet locatiegebonden. In de scrap komen onder meer voor:

- `app/amsterdam-vondeltuin/...`
- `app/amsterdam-house-of-watt/...`

Dat bevestigt dat de scanflow niet globaal was, maar per uitgiftepunt werkte.

### Oude kernflow

De operationele flow was:

1. inloggen
2. werken binnen een locatiecontext
3. order opzoeken of scannen
4. pickup-scherm openen
5. orderstatus bekijken
6. uitgifte bevestigen of annuleren

Concreet zichtbaar in de oude UI:

- Dashboard
- `Scan bestelling`
- `Orders`
- pickup-detail met status `Nog niet opgehaald`

### Oude order/pickup-velden

Uit `pickup.txt` en de orderschermen komen deze velden expliciet naar voren:

- `location_id`
- `address_id`
- `shopify_id`
- `pickup_code`
- `reference` zoals `#BB-25-7898`
- `pickup_date`
- `pickup_time`
- `created_at`
- `updated_at`
- `fulfilled_at`

Ook zichtbaar in de UI:

- klantnaam
- pickup-datum
- pickup-tijd
- orderregels / boomvarianten
- status: opgehaald of nog niet opgehaald

### Oude orders-overview

De lijstweergave in `Orders - Beter Boompje.html` toont minimaal:

- `Customer`
- `Pickup date`
- `Scan code`
- `Created at`

Dat is belangrijk: de oude operationele lijst werkte niet op een volledig commerce-overzicht, maar op een beperkte set scan-relevante velden.

### Oude scanflow

Uit `Html notive/Scan Tree - Beter Boompje.html` blijkt:

- QR-scanner via `html5-qrcode`
- handmatige fallback input
- Livewire action `scanCode`
- scannerroute per locatie

Dat bevestigt het juiste patroon voor de nieuwe app:

- camera scan
- handmatige invoer fallback
- server-side validatie
- statusrespons direct terug naar UI

### Oude adminflow

Uit `users.txt` en HAR-captures blijkt:

- users beheren via `admin/users`
- locations beheren via `admin/locations`
- gebruikerslijst had minimaal `Name` en `Email`
- er was een relatie tussen users en locations, ook al is die niet schoon te reconstrueren uit de scrap alleen

## Wat we functioneel meenemen

Uit de oude app nemen we deze concepten mee:

- locatie als verplichte operationele context
- scanbare pickup-code
- aparte operationele orderkopie naast Shopify
- pickup-confirmatie als expliciete handeling
- duidelijke scheiding tussen scanner-ui en admin-ui
- auditbare historie van handelingen

Uit `references/notive-briefing-sprint00` komt daar nog een belangrijke nuance bovenop:

- de oude Notive-scope was groter dan alleen scanner + portal
- er zat ook pickup-slotting, locatiebeheer, exports, refunds en thuisbezorgd-logic in
- de pickup-portal was onderdeel van een bredere operationele keten rond Shopify

Voor de rebuild betekent dit:

- de nieuwe app moet platformmatig denken
- maar de MVP moet scherp blijven op de operationele pickup-kern
- webshopflow, thuisbezorgd en refunds zijn relevante vervolgfases, geen eerste bouwstap

Uit jouw oude database-analyse nemen we aanvullend mee:

- personen: account/customer-profielen
- fysieke assets: trees, identifiers, treelocations
- gebeurtenissen: actions, evaluations, transports
- locaties: distributionpoints, nurseries, fields

De overlap tussen oude Notive-flow en oude AEK-database is dus:

- order/adoptie koppeling
- fysieke uitgifte op locatie
- eventgeschiedenis
- scan of identificatie als startpunt
- rol- en rechtenstructuur

## Wat we expliciet niet meenemen

- Laravel/Filament/Livewire als stack
- oude auth-implementatie met eigen wachtwoorden
- statuslogica via losse tekstvelden
- circulaire FK-patronen
- live Shopify-calls als primaire scanbron
- impliciete relaties zonder harde constraints

## Nieuwe doelarchitectuur

## Productrichting

Een gecombineerde interne app voor:

- BB scanner + beheer
- AEK scanner + beheer
- later uitbreidbaar met bomen, retouren en logistiek

De app moet multi-project en multi-locatie kunnen werken binnen hetzelfde systeem.

Aanbevolen scheiding:

- `projects`: BB, AEK
- `seasons`: jaar- of campagnefilter binnen een project
- `locations`: fysieke uitgifte- of retourpunten
- `pickup_targets`: scanbare operationele eenheden
- `pickup_events`: eventlog

Aanvulling op basis van de oude briefing:

- `product_variants`: centrale variant- en kleurmapping
- `project_memberships`: toegangslaag voor gebruikers per project
- `seasons`: expliciete jaarganglaag voor BB en AEK
- exports en readiness checks horen bij de adminlaag
- cutover moet expliciet worden ontworpen, niet impliciet gebeuren

## Verschil tussen BB en AEK

BB en AEK delen een operationele laag, maar niet hetzelfde brondomein.

BB:

- ordergedreven
- nu gekoppeld aan Shopify
- ordernummers bevatten seizoensinformatie zoals `#BB-24-*` en `#BB-25-*`
- pickup volgt uit bestelling en uitgifte

AEK:

- boomgedreven
- relatie draait om boom + eigenaar + jaar
- dezelfde boom kan meerdere jaren aan dezelfde eigenaar gekoppeld blijven
- Shopify is voor AEK nog geen vaste aanname

Daarom moet de architectuur niet draaien om "een Shopify-order is de waarheid".
De juiste lichte kern is:

- `project`
- `season`
- `pickup_target`
- `pickup_event`

Voor BB is een target in MVP gekoppeld aan een order.
Voor AEK kan een target later gekoppeld zijn aan een boomclaim of eigenaarschap.

## Nieuwe stack

- frontend: Astro
- markup/css-systeem: Client-First
- auth/data/api: Supabase
- commercebron: Shopify
- async sync/backfill: Supabase Edge Functions of aparte worker
- assistent/workflow: Claude

## Scopebesluit

Aanbevolen aanpak:

- architectuur direct multi-project maken voor BB, AEK en latere partijen
- eerste live operatie richten op BB als primaire pilot
- AEK meenemen in het datamodel en rechtenmodel vanaf dag 1
- niet wachten met project-isolatie tot later, want dat raakt schema, RLS en adminschermen

Dus:

- platformfundament nu
- volledige operationele uitrol per project gefaseerd

Praktisch betekent dat:

- multi-project: ja
- seizoensfilter: ja
- meerdere bronsystemen mogelijk: ja
- generiek enterprise-platform met alle varianten direct uitwerken: nee

## Client-First basis in deze workspace

De aangeleverde frameworkmap staat in:

- `references/client-first-framework/client-first-v2-2.webflow`
- `references/client-first-framework/css-variables`

Belangrijke bronbestanden:

- `references/client-first-framework/client-first-v2-2.webflow/css/client-first-v2-2.css`
- `references/client-first-framework/client-first-v2-2.webflow/style-guide.html`
- `references/client-first-framework/css-variables/Layout-variables.csv`
- `references/client-first-framework/css-variables/Sizes-variables.csv`
- `references/client-first-framework/css-variables/Thema-variables.csv`
- `references/client-first-framework/css-variables/Typography-variables.csv`

Dit betekent voor de rebuild:

- we bouwen Astro-templates met Client-First class naming
- we gaan geen tweede utility-systeem naast Client-First introduceren
- design tokens moeten vanuit deze variabelen worden overgenomen
- componenten krijgen semantische wrappers plus Client-First utility/combo-klassen

## Client-First conventies die we moeten volgen

Uit de style guide en CSS blijken onder meer deze patronen:

- layout wrappers: `padding-global`, `padding-section-large`, `padding-section-medium`, `container-large`, `container-medium`, `container-small`
- typography helpers: `text-size-tiny`, `text-size-small`, `text-size-medium`, `text-size-large`
- sizing helpers: `max-width-xsmall`, `max-width-small`, `max-width-medium`, `max-width-large`, `max-width-xlarge`, `max-width-xxlarge`
- grid helpers: `grid-1-col`, `grid-2-col`, `grid-3-col`, `grid-4-col`, `grid-autofit-*`, `grid-autofill-*`
- spacing helpers: `margin-*`, `padding-*`, `margin-top-*`, `margin-bottom-*`, `padding-horizontal-*`, `padding-vertical-*`
- form classes: `form_component`, `form_form`, `form_field-wrapper`, `form_label`, `form_input`, `form_checkbox`, `form_radio`, `form_message-success`, `form_message-error`
- button classes: `button`, `button is-small`, `button is-large`, `button is-secondary`, `button is-text`

Belangrijke layouttokens uit `Layout-variables.csv`:

- global padding: `2.5rem`
- section padding small: `3rem`
- section padding medium: `5rem`
- section padding large: `8rem`
- spacing scale van `0.125rem` tot `12rem`

## Gevolg voor Astro-opbouw

De nieuwe app moet in Astro niet worden opgebouwd als:

- losse pagina's met ad-hoc classnames
- random CSS-modules zonder relatie tot Client-First
- een nieuw utility-framework bovenop het bestaande systeem

Wel doen:

- vaste page wrappers met `padding-global` + `container-*`
- herbruikbare Astro components die Client-First classes renderen
- forms en knoppen consistent met de style guide
- design tokens centraal vanuit de Client-First variabelen
- domeincomponenten zoals scan card, order card en admin table bovenop deze class-structuur

## Aanbevolen Supabase v1 model

Minimale kern voor MVP:

- `projects`
- `seasons`
- `locations`
- `staff_profiles`
- `shopify_customers`
- `shopify_orders`
- `shopify_order_items`
- `pickup_targets`
- `pickup_events`
- `admin_overrides`
- `audit_logs`
- `sync_jobs`

Uitbreiding fase 2:

- `trees`
- `tree_movements`
- `return_events`

## Waarom `seasons` nodig is

We hebben een lichte jaarlaag nodig, geen zwaar portfolio-model.

`seasons` lost drie dingen op:

- filteren per jaar of campagne
- onderscheid tussen `BB-24`, `BB-25` en volgende seizoenen
- ruimte voor AEK om eigenaarschap per jaar te modelleren, ook als dezelfde boom doorloopt

Voor BB:

- `season` kan worden afgeleid uit orderprefix zoals `#BB-24-`
- Shopify-orders en pickup-targets krijgen een `season_id`

Voor AEK:

- `season` wordt expliciet onderdeel van boom-eigenaarschap en uitgifterondes
- de bron hoeft niet Shopify te zijn

## Waarom `pickup_targets` centraal moet staan

De oude Notive-flow lijkt op orderniveau te werken, maar dat is te beperkt voor de nieuwe versie.

`pickup_targets` lost dat op:

- MVP: 1 target per order
- later: meerdere targets per order
- later: target per line item
- later: target per boomclaim of ticket

Zo voorkomen we een schema-breuk wanneer BB en AEK net andere operationele flows nodig hebben.

Aanvulling:

- BB gebruikt in MVP vooral `target_type = order`
- AEK kan later richting `target_type = tree_claim`
- de scannerflow kan dan hetzelfde blijven terwijl de bronstructuur verschilt

## Nieuwe statusmodellen

Niet alles in 1 status proppen. Minimaal scheiden in:

- `shopify_status`
- `payment_status`
- `pickup_status`
- `eligibility_status`
- `return_status`
- `tree_status`

De leidende operationele status voor scanner en uitgifte is:

- `pickup_status`

Belangrijk:

- `eligibility_status` mag nooit de enige bron van waarheid zijn
- eligibility moet live worden bepaald in serverlogica of RPC
- een eventuele kolom is hooguit cache of laatste bekende uitkomst

## Nieuwe Astro app-structuur

Aanbevolen routes:

- `/login`
- `/app`
- `/app/scan`
- `/app/orders/[id]`
- `/app/history`
- `/app/locations/select`
- `/app/admin/orders`
- `/app/admin/locations`
- `/app/admin/users`
- `/app/admin/audit`

Aanvullend voor multi-project:

- projectcontext in profiel of sessie
- locatiecontext verplicht voor scanner-rollen

Aanbevolen Astro-structuur in combinatie met Client-First:

- `src/layouts/AppLayout.astro`
- `src/layouts/AuthLayout.astro`
- `src/components/ui/Button.astro`
- `src/components/ui/FormField.astro`
- `src/components/ui/PageHeader.astro`
- `src/components/ui/StatusBadge.astro`
- `src/components/scan/ScannerPanel.astro`
- `src/components/orders/OrderSummaryCard.astro`
- `src/components/orders/PickupConfirmationCard.astro`
- `src/components/admin/AdminTable.astro`
- `src/styles/client-first.css`
- `src/styles/theme.css`

Waarbij:

- `client-first.css` de frameworkbasis overneemt of importeert
- `theme.css` alleen projectspecifieke tokens en overrides bevat
- component markup de Client-First classes direct gebruikt

## Rebuild van de scanflow

Nieuwe flow:

1. login via Supabase Auth
2. project kiezen of automatisch bepalen
3. locatie kiezen of bevestigen
4. QR scannen of code invoeren
5. `POST /api/scan/resolve`
6. server valideert target, order, betaling, locatie en pickup-status
7. UI toont directe statuskaart
8. `POST /api/pickups/confirm`
9. event schrijven + status atomisch updaten
10. Shopify async terugkoppelen

Databaseborging:

- pickup-confirmatie mag alleen via RPC/serveractie
- directe client-updates op `pickup_targets` zijn niet toegestaan
- bevestiging gebeurt alleen vanuit status `ready`
- location-check en eligibility-check gebeuren vlak voor confirm opnieuw

## API-contracten voor MVP

- `POST /api/scan/resolve`
- `POST /api/pickups/confirm`
- `POST /api/pickups/reverse`
- `GET /api/orders/search?q=`

`/api/scan/resolve` input:

- `qr_value`
- `location_id`

Output:

- target samenvatting
- order samenvatting
- `eligibility_status`
- reden / feedback voor UI

## Rollen

Minimaal:

- `scanner`
- `location_manager`
- `admin`

Richting:

- scanner mag lezen/scannen voor relevante locatie
- manager mag lokale overrides doen
- admin beheert alles

Extra eis:

- project-isolatie moet in RLS zitten
- een BB-medewerker mag geen AEK-data kunnen lezen
- locatiebeperking hoort zoveel mogelijk ook server-side en in policy-richting terug te komen

## Belangrijkste ontwerpconclusie uit de scrapmap

De oude Notive-app was geen generieke CRM-tool, maar een relatief smalle operationele pickup-portal met:

- locatiecontext
- Shopify-orderkopie
- scanbare code
- pickup-bevestiging
- eenvoudige admin voor users en locations

De oude AEK-database is juist breder en domeinrijker:

- klanten
- assets
- logistiek
- events
- evaluaties

De juiste nieuwe richting is dus:

- Notive-flow gebruiken als UX- en operatiebasis
- AEK-domein gebruiken als datamodelrichting
- alles normaliseren in Supabase
- BB en AEK samenbrengen in 1 multi-project systeem

## Lessen uit eerdere fouten

De eerder opgetreden productieproblemen moeten expliciet in het nieuwe ontwerp landen:

- sync moet observable zijn met counts, retries en discrepancy-detectie
- per project en per locatie moet readiness zichtbaar zijn
- piekuren mogen zware sync-jobs blokkeren
- variantkleur en uitgifte-informatie horen in data, niet alleen in frontendlogica
- pickup-confirmatie moet twee-staps en atomisch blijven
- eligibility moet live worden berekend om stale state te voorkomen

Concreet betekent dat in Supabase:

- `sync_jobs` uitbreiden met batch- en verificatievelden
- `admin_sync_health` view
- `location_readiness` view
- `product_variants` tabel
- `confirm_pickup()` RPC
- projectgefilterde RLS via memberships

## Cutover-strategie

Dit ontbrak nog en moet onderdeel van het plan zijn.

Aanbevolen overgang:

1. Shopify blijft de bron van commerce
2. nieuwe Supabase-app draait eerst in shadow mode mee
3. orders worden parallel ingelezen en vergeleken
4. admin-checks gebruiken `admin_sync_health` en `location_readiness`
5. pas bij stabiele reconciliatie gaat scannerverkeer over
6. oude portal blijft tijdelijk fallback tijdens overgang

Dus niet:

- oude portal uitzetten op basis van vertrouwen alleen
- live gaan zonder counts per project en locatie te vergelijken

## Aanbevolen bouwvolgorde

1. Supabase schema v1 opzetten voor operationele kern
2. Multi-project memberships + project-RLS toevoegen
3. Auth + staff profiles + locations
4. Shopify sync v1 met lokale cache en discrepancy checks
5. Astro scannerflow bouwen
6. orderdetail + confirm pickup via RPC
7. admin sync health + location readiness
8. admin orders/users/locations
9. audit + overrides
10. trees/returns/logistics uitbreiden

## Praktische MVP-scope

Voor een eerste werkende versie zou ik beperken tot:

- login
- project + locatiecontext
- seizoenscontext of seizoensfilter
- ordercache uit Shopify
- scan/lookup
- validatie op betaald/geannuleerd/al opgehaald/verkeerde locatie
- pickup bevestigen
- event logging
- sync health en locatie readiness
- projectisolatie in rechtenmodel
- eenvoudige admin voor orders, users en locations

Nog niet in MVP:

- volledige boomasset-flow
- volledige AEK meerjaren-eigenaarschapsflow
- retourproces
- uitgebreide dashboards
- offline modus
- volledige thuisbezorgd-flow
- volledige Shopify storefrontlogica
- refund-import/export flow

## Concrete volgende stap

De logische volgende stap in deze workspace is:

1. de tweede Supabase migratie toepassen en valideren
2. seasons voor BB en AEK toevoegen
3. seed-data voor BB en AEK toevoegen
4. daarna een Astro projectstructuur aanmaken
5. daarna de scan-API en pickup-flow implementeren

Als we direct gaan bouwen, moet de eerste databaseversie primair draaien om:

- `projects`
- `seasons`
- `locations`
- `staff_profiles`
- `shopify_orders`
- `shopify_order_items`
- `pickup_targets`
- `pickup_events`

Alles daarbuiten is daarna uitbreidbaar zonder de scan-MVP stuk te trekken.
