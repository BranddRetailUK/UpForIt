[contract]
format=ai_context_v1
purpose=canonical repository context for future coding agents; prefer this file over inference; verify source/runtime state before destructive or production actions
scope=BranddRetailUK/UpForIt repository plus its explicit Good Game Apparel merch dependency
last_source_audit=2026-08-04
upforit_revision_at_audit=6df223c
good_game_revision_at_audit=7a04cb08
secrets_policy=never write secret values, Stripe keys, database URLs, Railway tokens, or HMAC secrets into source/docs/client bundles/logs

[priority_invariants]
MUST=keep Good Game Apparel as commerce source of truth for products, variants, SKU, canonical price, weight, availability, stock, shipping, Stripe, orders, fulfilment, refunds, admin operations, and transactional email
MUST=keep UpForIt as presentation/cart-intent/server-proxy layer; no duplicated product/order database in this repository
MUST=perform all Stripe operations through Good Game; UpForIt browser/server must not use UpForIt-local Stripe credentials even if present in an untracked environment
MUST=send only variant IDs, quantities, idempotency key, and registered return URLs into checkout; never trust or forward browser prices
MUST=keep `STANDALONE_STOREFRONT_UPFORIT_SECRET` server-only and identical on UpForIt + Good Game
MUST=use Good Game LIVE admin/service for UpForIt work; do not implement/deploy this feature through the separate Good Game Railway Testing admin UI
MUST=preserve `www.upforitevents.co.uk` as canonical public origin
MUST_NOT=model UpForIt as a fake creator, create creator commission/rewards, or store UpForIt products in local JSON/DB copies
MUST_NOT=allocate a UFI order number before successful payment
MUST_NOT=expose product costs/admin fields/storefront secret/database URL to browser code

[repository]
remote=https://github.com/BranddRetailUK/UpForIt.git
default_branch=main
application_root=frontend-next
root_package_json=absent
start_note=Start Commands.md contains `npm run dev`; execute from `frontend-next`
framework=Next.js 14.2.35 App Router + React 18.2 + strict TypeScript
runtime_dependencies=next,react,react-dom,pg,sharp
styles=single global stylesheet at frontend-next/app/globals.css
tests=none in this repository at audit time
generated_dirs=frontend-next/.next,frontend-next/node_modules; ignored; never commit
environment_files=.env/.env.* ignored except tracked `.env.example`; never commit actual env files

[commands]
install=cd frontend-next && npm ci
dev=cd frontend-next && npm run dev
build=cd frontend-next && npm run build
start=cd frontend-next && npm start
lint=cd frontend-next && npm run lint
minimum_release_check=npm run build; git diff --check; git status --short

[production_deployment]
provider=Railway
project_id=f2b0b5dd-cc1f-4b80-b7bd-c0f3939ae013
production_environment_id=9878dca0-f0ef-4e9c-8d1a-84fe67bef158
frontend_service_id=6a6a3e88-d4d3-4a09-882e-0f1e1125b99a
target_port=8080
railway_service_domain=frontend-production-7f37.up.railway.app
canonical_custom_domain=www.upforitevents.co.uk
canonical_origin=https://www.upforitevents.co.uk
apex_domain=upforitevents.co.uk is GoDaddy-managed permanent 301 forwarding to canonical origin; apex is intentionally not attached to Railway
apex_dns_rule=do not add CNAME @ in GoDaddy; GoDaddy does not provide apex CNAME flattening; forwarding owns GoDaddy-managed apex A records
www_dns_rule=retain CNAME www -> Railway-provided target shown by Railway/GoDaddy; do not replace with apex forwarding A records
deployment_rule=observe terminal Railway deployment SUCCESS before reporting a deploy complete

[environment_contract]
NEXT_PUBLIC_SITE_URL=public canonical origin; tracked example sets https://www.upforitevents.co.uk; currently documentation/config only and not read by source
GOOD_GAME_API_BASE=server-only Good Game API origin; production value https://dashboard.ggapparel.co.uk
STANDALONE_STOREFRONT_KEY=server-only registry key; default/upforit production value `upforit`
STANDALONE_STOREFRONT_UPFORIT_SECRET=server-only shared HMAC secret; required for checkout, confirmation, cache revalidation, and checkout requester hashing
DATABASE_URL=server-only Postgres connection; required for email signup persistence and durable checkout intent/rate limiting
NODE_ENV=production enables Postgres TLS with rejectUnauthorized=false
STRIPE_*=intentionally unused by this application; Good Game owns Stripe
failure_without_GOOD_GAME_API_BASE=catalog/product helpers return empty/null; checkout construction throws and API returns unavailable
failure_without_secret=signed operations fail; checkout guard returns secure checkout not configured/unavailable
failure_without_DATABASE_URL=signup fails; checkout guard fails closed with 503; static pages/catalog rendering can still work

[global_layout]
file=frontend-next/app/layout.tsx
composition=CartProvider > site-shell > PopArtScene + SiteHeader + main route content + SiteFooter
fonts=Google Bangers(display), Archivo Black(heavy), Space Grotesk(body) via next/font
metadata_base=https://www.upforitevents.co.uk
default_title=UPFORIT | Events, Music & Good Vibes
open_graph=static Cloudinary Summer Roundup image
favicon=frontend-next/app/icon.tsx; edge-rendered 512x512 smiley PNG
global_cart=CartProvider mounted for every route; drawer and header count available site-wide

[public_routes]
/=home hero, round logo, event/merch CTAs, three house rules, email signup
/events=static Summer Roundup card; 26 September 2026; noon-11PM; McCarthys Sports Bar; tickets/lineup pending
/merch=server-rendered live Good Game catalogue grid; friendly empty/error placeholder
/merch/[slug]=server-rendered product gallery, description, price, options, quantity, add-to-cart; missing product -> Next notFound
/cart=client cart review, canonical refresh, cancellation notice, totals, secure checkout
/cart/confirmation=Stripe return page; validates session_id shape; polls settlement; noindex
/socials=TikTok/Facebook/Instagram profile cards
/contact=social-profile contact links only; no contact form/email endpoint

[api_routes]
POST_/api/signup=accept JSON or form email; trim/lowercase; regex validate; create `signups` table on demand; unique insert with ON CONFLICT DO NOTHING
POST_/api/merch/cart=public dynamic canonical cart refresh; fetch Good Game catalogue no-store; drop unknown/unavailable variants; cap each quantity 1..20; return canonical display lines + removed count/IDs
POST_/api/merch/checkout=node runtime; validate numeric variant IDs and quantity 1..20; validate `ufi_<uuid>` intent; reserve/rate-limit in Postgres; HMAC-sign server request to Good Game; return upstream Stripe Checkout URL/payload
GET_/api/merch/confirmation=node dynamic; validate Stripe session id `cs_...`; HMAC-sign Good Game lookup; return safe upstream confirmation payload
POST_/api/merch/revalidate=node runtime; Good Game callback; read exact raw body; require timestamp within 300 seconds + constant-time HMAC; invalidate merch tag/path

[site_content_sources]
navigation_and_socials=frontend-next/lib/site.ts
TikTok=https://www.tiktok.com/@upforit.events handle @upforit.events
Facebook=https://www.facebook.com/up4ituk handle @up4ituk
Instagram=https://www.instagram.com/up_for_it_events_uk handle @up_for_it_events_uk
event_content=hard-coded in frontend-next/app/events/page.tsx
footer_year=hard-coded 2026
contact_method=social links only

[visual_system]
source=frontend-next/app/globals.css + frontend-next/components/PopArtScene.tsx
tokens=ink #050505; paper #ffffff; blue #008ef0; blue-light #29c6f5; blue-deep #0065d9; yellow #ffdf00; pink #d90062; muted #dfeef8
style=bold pop-art/comic; thick black borders; offset shadows; halftone/radial blue scene; pink/yellow accents; rotated cards/stickers
responsive_breakpoints=900px,760px,720px,430px
motion=PopArtScene scroll parallax; desktop direct and mobile eased; disabled for prefers-reduced-motion
header=sticky; hides after 16px accumulated downward scroll; reappears upward/top/focus; mobile menu locks body and closes on Escape/route change
cart_drawer=right fixed panel + backdrop; body lock; Escape/backdrop close
accessibility=semantic headings/landmarks; focus-visible ring; aria labels/current state; reduced-motion support; cart/confirmation noindex where appropriate

[brand_assets]
module=frontend-next/lib/cloudinary.ts
cloud_name=brandduk
delivery_base=https://res.cloudinary.com/brandduk/image/upload
site_assets=navLogo WHITE_LOGO_WEB_filqtw; roundLogo NEW_ROUND_LOGO_amtvr0; smiley SOLID_SMILEY_taznwv; summerRoundup SUMMER_ROUND_UP_e2jcsl
image_helper=custom responsive `<img>` src/srcset generator; widths 240..1476; Cloudinary f/q/c_limit/w transforms; not Next Image
next_remote_image_hosts=cdn.shopify.com,res.cloudinary.com
merch_images=URLs supplied canonically by Good Game; normally Cloudinary; never upload/store copies here

[merch_topology]
frontend=UpForIt repository/Next service
backend=Good Game Apparel sibling repository `../Good Game Apparel`
backend_remote=https://github.com/BranddRetailUK/discord-shopify-bot.git
backend_api_origin=https://dashboard.ggapparel.co.uk
backend_store_key=upforit
backend_store_name=UpForIt Events
currency=GBP only
delivery=Great Britain/UK only
checkout=Stripe-hosted checkout on existing Good Game Stripe account
fulfilment=Good Game Apparel
product_data_replication=none
shared_secret_transport=timestamped HMAC SHA-256 server-to-server only
signature_message=`timestamp.METHOD.path.body`; GET body empty; path includes query when confirmation is signed
signature_headers=x-storefront-timestamp,x-storefront-signature

[good_game_public_api_contract]
GET_/api/standalone-storefronts/upforit/catalog=public; live mappings only; product list with id, stable slug, title, description, kind, currency, canonical minor price, ordered images/options/variants, availability; excludes costs/admin data
GET_/api/standalone-storefronts/upforit/products/:slug=public; live mapped product only; 404 if absent/hidden
POST_/api/standalone-storefronts/upforit/checkout-session=HMAC required; canonical server revalidation of items/SKU/price/weight/availability/quantity; validates registered UpForIt return origin; creates Good Game Stripe Checkout Session
GET_/api/standalone-storefronts/upforit/checkout-confirmation=HMAC required; safe customer-facing status/order response; may idempotently settle a paid session if webhook is pending

[good_game_admin_product_workflow]
admin_target=LIVE Good Game admin UI only; dedicated `UpForIt Collection` navigation under collections permission
create_shortcut=Create UpForIt Product selects standalone destination then reuses Good Game template/Product Creator logic
product_record=normal Good Game `products` + variants/images/SKUs/weights/costs; no creator identity
mapping_record=`standalone_storefront_products(store_key=upforit,product_id,status,display_order,published_at,...)`
initial_publication=draft; creation job must persist/verify exact mapping before reporting completion
artwork_folder=standalone_storefront_artwork/upforit; never shared creator_artwork/fake creator folder
admin_features=collection totals, live/draft/attention counts, search by title/id, publication filter, reorder, attach existing product as draft, edit, publish, hide, public view
publish_requirements=product listing not globally/dashboard hidden; image exists; at least one variant has SKU + positive canonical price + positive weight
catalog_visibility=mapping status live + valid visible product; draft/hidden mappings absent from public API
publication_side_effect=signed callback to UpForIt `/api/merch/revalidate`; 60-second frontend cache remains fallback
existing_product_attachment=admin can attach Good Game product ID as draft; internal standalone marker added
authorization=Good Game admins only; regular creator sessions cannot forge standalone destination/header or publish
product_removal=hide/unpublish; do not delete product automatically

[merch_catalog_cache]
catalog_fetch=Next fetch revalidate 60 seconds; tag `upforit-merch`
product_fetch=Next fetch revalidate 60 seconds; tags `upforit-merch`,`upforit-product:<slug>`
revalidation=callback invalidates shared `upforit-merch` tag and `/merch` layout; optional body productId also invalidates `upforit-product:<productId>`
implementation_note=specific callback tag uses product ID while product fetch tag uses slug; shared `upforit-merch` tag currently guarantees correctness; if shared invalidation is narrowed, reconcile ID/slug tagging first
cart_refresh=no-store catalogue read so cart prices/availability are canonical at refresh time

[product_page_logic]
available_variants=filter upstream variants where available=true
default_variant=first available
options=prefer upstream option definitions; otherwise derive Option 1/2/3 unique values
option_change=prefer variant preserving other selected option values; fall back to first available variant matching changed option
quantity_selector=1..5 per add action
line_image=variant image ID match else first product image
unavailable_state=no available variant -> Currently unavailable; no add button

[cart_contract]
storage_key=upforit.merch.cart.v1 in localStorage
stored_shape=productId,variantId,slug,title,variantLabel,imageUrl,priceMinor,currency,quantity
storage_security=display cache only; never authoritative for price/availability/checkout
hydrate=normalize numeric variant IDs; quantity cap 1..20; fetch canonical cart once after restore
hydrate_failure=retain normalized stored lines and log generic warning; later cart-page refresh/Good Game checkout still fail closed against canonical state
add_same_variant=merge quantity; cap total 20; open drawer
remove=quantity below 1 or explicit Remove deletes line
count=sum quantities
cart_page_refresh=once on mount; replaces all lines with canonical response; unavailable lines removed with notice; refresh error shown
display_total=sum canonical/refreshed line priceMinor*quantity; shipping excluded
shipping_copy=calculated securely by Good Game; UK only

[checkout_intent_and_rate_limit]
intent_storage_key=upforit.merch.checkout-intent.v1 in sessionStorage
intent_format=ufi_<crypto.randomUUID()>
intent_reuse=same sorted variantId:quantity fingerprint reuses key; cart fingerprint change creates new key
request_hash=SHA-256 of sorted variantId:quantity entries
requester_hash=SHA-256(secret + resolved forwarded/client IP + first 240 user-agent chars); raw IP not stored
table=merch_checkout_requests; created on demand
table_columns=idempotency_key PK,request_hash,requester_hash,attempt_count,created_at,last_attempt_at
concurrency=Postgres transaction + requester advisory lock
idempotency_conflict=same key with different cart -> 409
rate_limit=maximum 8 new checkout intents per requester per 10 minutes; valid retries of same key do not count as new; 429 includes Retry-After 600
retention=opportunistically delete rows whose last_attempt_at is older than 7 days
database_failure=fail closed with 503; never bypass rate/idempotency guard

[checkout_flow]
1=cart page sends variant IDs + quantities + stable idempotency key to local `/api/merch/checkout`
2=local API validates shapes, reserves intent, derives current request origin, builds success/cancel URLs
3=local API signs exact JSON body and calls Good Game
4=Good Game independently loads canonical DB variants/prices/weights/availability and calculates UK shipping
5=Good Game creates Stripe Checkout Session; browser redirects to returned Stripe URL
6=Stripe collects email, phone, GB shipping address, billing address, payment details; UpForIt never receives card data
7=success returns `/cart/confirmation?session_id={CHECKOUT_SESSION_ID}`; cancel returns `/cart?checkout=cancelled`
8=confirmation proxy signs lookup; client polls every 1500ms up to 20 attempts; clear cart only when `paid=true`
9=if settlement still pending after polling, show preparation/email fallback; payment/order remain owned by Good Game

[shipping]
country=GB only via Stripe allowed countries
calculation=Good Game existing UK small-item/standard shipping helper; never calculate/trust shipping in browser
small_item_rule=discounted small-item shipping applies only when cart contains exactly one eligible item at quantity one; multiple quantities/lines use standard shipping

[orders]
registry_display_name=UpForIt Events
number_prefix=UFI-
counter_floor=137
first_configured_paid_number=UFI-00138 unless existing higher matching orders advance collision-safe counter
allocation=after confirmed successful Stripe payment only; transactionally lock/increment storefront counter; reconcile existing UFI maximum; webhook/confirmation retries idempotent
metadata=storefront_key upforit; storefront_name UpForIt Events; storefront_type standalone; compatibility source category storefront
admin_display=UpForIt Events in source/location and Creator / Store fields
admin_support=search,filters,packing slips,labels,tracking,invoices,customer edits,refunds,stock workflow,reporting
excluded=creator commission,creator rewards,creator coins,Discord creator notifications,creator revenue

[transactional_email]
owner=Good Game authenticated SendGrid/transactional pipeline
customer_sender_name=UpForIt Events
lifecycles=order confirmed,shipped/tracking added,out for delivery,delivered,refunded
brand_detection=storefront metadata,not order-number pattern alone
branding=UpForIt logo/pop-art palette/links/UFI order number + `Fulfilled by Good Game Apparel` disclosure
idempotency=Good Game transactional event keys prevent duplicate retry sends
reply_handling=Good Game operational email infrastructure
changes_to_email_templates=make in Good Game repository,not this repository

[signup_data]
owner=UpForIt Postgres
table=signups(id serial PK,email unique not null,created_at timestamptz)
normalization=trim+lowercase
duplicate_behavior=success without duplicate row
current_scope=collect email only; no ESP/newsletter sync, consent ledger, confirmation email, unsubscribe route, or admin UI in this repo

[database_runtime]
module=frontend-next/lib/db.ts
driver=pg Pool
pool_lifetime=development cached on globalThis; production creates module/runtime pool without global cache
schema_management=runtime CREATE TABLE IF NOT EXISTS in signup/checkout paths; no migration framework at audit time
production_tls=ssl rejectUnauthorized=false
tables_owned_here=signups,merch_checkout_requests
tables_not_owned_here=products,variants,orders,checkout sessions,stock,fulfilment,email events; all Good Game

[security]
server_only_modules=lib/merch.ts and lib/merch-checkout-guard.ts import server-only
hmac=SHA-256; exact timestamp/method/path/body binding; revalidation comparison constant-time; 300-second inbound callback tolerance
checkout_validation=local shape validation + Good Game canonical validation; browser price ignored
return_urls=derived from request origin and upstream allowlisted against registered UpForIt origin
session_id_validation=`^cs_[A-Za-z0-9_]+$`
cart_ids=numeric variant IDs only
quantity_limits=1..20 API/cart; product selector 1..5 per click
payment_data=Stripe hosted; no card storage/handling in UpForIt
known_absence=signup endpoint has no explicit rate limiter/CAPTCHA/consent checkbox

[seo_and_indexing]
canonical_origin=www
root_and_static_pages=per-page Metadata canonical values
product_metadata=dynamic title/description/canonical/OpenGraph primary image from Good Game product
cart_and_confirmation=robots noindex,nofollow
sitemap=absent
robots_file=absent
analytics=absent in tracked source
cookie_banner=absent

[operational_playbook_product]
create_or_manage=Good Game LIVE admin -> UpForIt Collection
new_product=use Create UpForIt Product; reuse templates/variants/SKUs/weights/prices/artwork; product ends draft
publish=verify listing visible + image + purchasable weighted SKU; click Publish; verify Good Game public catalog then www merch page
hide=click Hide; never delete merely to remove from storefront
repair_missing_mapping=attach existing Good Game product ID as draft in UpForIt Collection; publish only after validation
empty_catalog_debug=check Good Game `standalone_storefront_products` mapping/status, product listing visibility, public catalog endpoint, UpForIt GOOD_GAME_API_BASE, then revalidation/cache
product_job_invariant=Good Game full/quick create must fail rather than report completion if exact upforit mapping is absent

[operational_playbook_checkout]
check_1=UpForIt DATABASE_URL reachable and `merch_checkout_requests` creatable
check_2=shared storefront secret exists and matches Good Game
check_3=GOOD_GAME_API_BASE points to https://dashboard.ggapparel.co.uk
check_4=public cart refresh returns canonical lines
check_5=Good Game checkout rejects stale/unavailable/zero-weight/price-tampered items and invalid return origin
check_6=Stripe webhook remains enabled on Good Game; never add a separate UpForIt Stripe webhook/account
check_7=confirmation returns paid status/UFI number before cart clears
check_8=verify order in Good Game LIVE admin and verify lifecycle email/stock update

[operational_playbook_domain]
canonical=https://www.upforitevents.co.uk
www=direct Railway custom domain
apex=GoDaddy 301 forwarding to www; forwarding only/no masking; GoDaddy provides forwarding HTTPS
do_not=attach apex directly to Railway while GoDaddy DNS remains authoritative; GoDaddy cannot create required flattened apex CNAME
verify=curl/dig both apex redirect and www 200; allow GoDaddy certificate provisioning time after forwarding edits

[change_ownership]
UpForIt_repo=site content, visual design, public routes, cart UX/local persistence, signed proxy endpoints, signup table/API, local checkout throttling, canonical/cache presentation
Good_Game_repo=product creator/admin collection, product/variant DB, mapping/publication, catalog API, canonical validation, shipping, Stripe, settlement, order number/admin, stock, fulfilment/refunds, transactional email
GoDaddy=apex forwarding/DNS only
Railway=service deployment, environment variables, Postgres connection, www custom domain

[known_current_content_and_maintenance]
home_merch_button=currently says `Merch loading` although merch is live; intentional-or-stale copy must be reviewed before unrelated UI edits
root_metadata=currently says `future merch`; review when doing SEO copy
event=single hard-coded 2026 Summer Roundup; no event CMS/API
footer=copyright year hard-coded 2026
merch_grid_images=raw img elements; product images likewise; Next remotePatterns remain available but these routes do not use Next Image
cart_confirmation=approximately 30-second polling window (20 attempts x 1.5s); does not retry forever
cart_provider=clearCart/open/close callbacks are stable useCallback functions; preserve stability to avoid confirmation effect loops
runtime_schema=DDL occurs on requests; future migrations must preserve existing rows/idempotency
production_dependency=Good Game API outage produces friendly catalog placeholder but disables canonical cart/checkout/confirmation

[verification_baseline]
upforit_build=Next production build passed at audited merch revision
good_game_focused_tests=36 standalone/admin/frontend-dashboard focused tests passed at audited dependency revision
good_game_full_suite=two unrelated pre-existing security-contract failures existed at audit: signup redirect syntax expectation and creator-theme allowlist expectation
live_smoke_at_audit=Good Game catalog returned product 47715 Premium T-Shirt; www `/merch` rendered it; Good Game LIVE admin bundles contained UpForIt Collection; unauthenticated admin API returned 401
repository_state_at_contract_creation=UpForIt and Good Game worktrees clean before this documentation file was added

[future_agent_rules]
read_first=contract.md, relevant source files, git status; then inspect sibling Good Game contract files for cross-service changes
assume_user_changes_owned=true
do_not_overwrite_unrelated_changes=true
use_apply_patch_for_source_edits=true
before_production_mutation=resolve exact Railway project/environment/service and distinguish Good Game LIVE from Testing
after_code_change=run proportionate checks; for this repo minimum Next build; for cross-repo changes run focused Good Game tests/builds
after_deploy=wait for terminal SUCCESS and smoke exact public/admin routes
documentation_update=update this file whenever route/env/data ownership/order semantics/domain topology or Good Game boundary changes
