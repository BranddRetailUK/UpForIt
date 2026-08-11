[contract]
format=ai_context_v1
purpose=canonical repository context for future coding agents; prefer this file over inference; verify source/runtime state before destructive or production actions
scope=BranddRetailUK/UpForIt repository, its native event-ticketing system, plus its explicit Good Game Apparel merch dependency
last_source_audit=2026-08-07
upforit_revision_at_audit=6fc6346+account-profile-dashboard
good_game_revision_at_audit=f81c98f0+account-order-history
secrets_policy=never write secret values, Stripe keys, database URLs, Railway tokens, or HMAC secrets into source/docs/client bundles/logs

[priority_invariants]
MUST=keep Good Game Apparel as merch commerce source of truth for products, variants, SKU, canonical merch price, weight, availability, stock, shipping, merch Stripe payments, merch orders, fulfilment, refunds, admin operations, and merch transactional email
MUST=keep UpForIt as presentation/cart-intent/server-proxy layer for merch; no duplicated merch product/order database in this repository
MUST=perform all merch Stripe operations through Good Game; native event-ticket Stripe Checkout and event-ticket webhooks are the explicit exception owned by UpForIt
MUST=send only variant IDs, quantities, idempotency key, registered return URLs, an optional server-resolved authenticated account UUID/verified email, and an optional server-resolved ticket-discount entitlement into checkout; never trust or forward browser prices, browser-authored account identity, or browser-authored discount values
MUST=keep `STANDALONE_STOREFRONT_UPFORIT_SECRET` server-only and identical on UpForIt + Good Game
MUST=use Good Game LIVE admin/service for UpForIt work; do not implement/deploy this feature through the separate Good Game Railway Testing admin UI
MUST=preserve `www.upforitevents.co.uk` as canonical public origin
MUST_NOT=model UpForIt as a fake creator, create creator commission/rewards, or store UpForIt products in local JSON/DB copies
MUST_NOT=allocate a Good Game merch or native event-ticket UFI public order number before successful payment; native ticket pending-checkout records use their internal UUID while Stripe Checkout is pending
MUST_NOT=expose product costs/admin fields/storefront secret/database URL to browser code

[repository]
remote=https://github.com/BranddRetailUK/UpForIt.git
default_branch=main
application_root=frontend-next
root_package_json=absent
start_note=Start Commands.md contains `npm run dev`; execute from `frontend-next`
framework=Next.js 16.3.0 App Router + React 19.2.4 + strict TypeScript
runtime_dependencies=next,react,react-dom,pg,sharp,stripe,bcryptjs,@sendgrid/mail,qrcode,pdf-lib,@zxing/browser
styles=single global stylesheet at frontend-next/app/globals.css
tests=Vitest coverage for ticket/email security helpers and automatic ticket-tier progression policy
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
apex_domain=upforitevents.co.uk is Cloudflare-proxied and permanently redirects to the canonical www origin
apex_dns_rule=retain the proxied placeholder A record used by the Cloudflare apex-to-www redirect rule; preserve path and query string
www_dns_rule=retain the proxied CNAME www -> 91uw3so1.up.railway.app
deployment_rule=observe terminal Railway deployment SUCCESS before reporting a deploy complete

[environment_contract]
NEXT_PUBLIC_SITE_URL=public canonical origin; tracked example sets https://www.upforitevents.co.uk; currently documentation/config only and not read by source
GOOD_GAME_API_BASE=server-only Good Game API origin; production value https://dashboard.ggapparel.co.uk
STANDALONE_STOREFRONT_KEY=server-only registry key; default/upforit production value `upforit`
STANDALONE_STOREFRONT_UPFORIT_SECRET=server-only shared HMAC secret; required for checkout, confirmation, customer merch-order history, cache revalidation, and checkout requester hashing
DATABASE_URL=server-only Postgres connection; required for email signup persistence and durable checkout intent/rate limiting
NEXT_PUBLIC_META_PIXEL_ID=public Meta dataset/pixel identifier; the only Meta value allowed in the browser bundle
META_CONVERSIONS_API_ACCESS_TOKEN=server-only token for consent-gated Lead and merch Purchase events
META_AD_ACCOUNT_ID=server-only `act_...` identifier used by the Meta Ads Insights helper
META_MARKETING_API_ACCESS_TOKEN=server-only `ads_read` token used by the Meta Ads Insights helper
META_APP_ID,META_APP_SECRET=server-only Meta developer app credentials; app secret is used to generate Insights appsecret_proof
META_GRAPH_API_VERSION=pinned Graph API version; production currently uses v25.0
META_TEST_EVENT_CODE=optional temporary Events Manager test code; keep unset for normal production traffic
NODE_ENV=production enables Postgres TLS with rejectUnauthorized=false
STRIPE_SECRET_KEY=server-only; used exclusively for native event tickets; Testing must use an sk_test key and APP_ENV=testing rejects live keys
STRIPE_TICKETS_WEBHOOK_SECRET=server-only signing secret for the dedicated native ticket webhook endpoint
APP_ENV=testing or production; controls Stripe livemode guard independently of NODE_ENV
TICKETING_ENABLED=explicit ticket-sales feature switch
MERCH_CHECKOUT_ENABLED=environment guard; false in Testing to prevent accidental calls into Good Game LIVE merch checkout
TICKET_QR_SIGNING_SECRET=server-only HMAC secret for regenerable, non-PII admission QR tokens
AUTH_RATE_LIMIT_SECRET=server-only salt for login/signup/reset rate-limit buckets
EMAIL_JOB_ENCRYPTION_KEY=server-only encryption key for durable email outbox payloads
ADMIN_BOOTSTRAP_EMAIL=verified account email promoted to admin on initial registration
SENDGRID_API_KEY=server-only worker credential; local SENDGRID_ACCESS_KEY and legacy misspelling SNEDGRID_ACCESS_KEY are accepted temporarily
SENDGRID_FROM_EMAIL,SENDGRID_REPLY_TO_EMAIL=private worker sender/reply identity; production uses info@upforitevents.co.uk
SENDGRID_FROM_NAME=private worker display name; production uses UPFORIT Tickets
EMAIL_FORCE_RECIPIENT,EMAIL_SUBJECT_PREFIX=Testing-only outbound mail safety; both must be absent in Production
EMAIL_FORCE_RECIPIENT=Testing safety override; all outbound mail is redirected to this address
failure_without_GOOD_GAME_API_BASE=catalog/product helpers return empty/null; checkout construction throws and API returns unavailable
failure_without_secret=signed operations fail; checkout guard returns secure checkout not configured/unavailable
failure_without_DATABASE_URL=signup fails; checkout guard fails closed with 503; static pages/catalog rendering can still work

[global_layout]
file=frontend-next/app/layout.tsx
composition=MetaTrackingProvider > CartProvider > site-shell > PopArtScene + SiteHeader + main route content + SiteFooter
fonts=Google Bangers(display), Archivo Black(heavy), Space Grotesk(body) via next/font
metadata_base=https://www.upforitevents.co.uk
default_title=UPFORIT | Events, Music & Good Vibes
open_graph=static Cloudinary Summer Roundup image
favicon=frontend-next/app/icon.tsx; edge-rendered 512x512 smiley PNG
global_cart=CartProvider mounted for every route; drawer and header count available site-wide

[public_routes]
/=home hero, round logo, event/merch CTAs, featured event, ticket-holder 20% merch promo immediately above featured merch, email signup; legacy House Rules markup is hidden at every breakpoint
/events=Summer Roundup card followed by the ticket-holder 20% merch promo; 26 September 2026; noon-11PM; McCarthys Sports Bar; links to native ticket sales
/events/summer-roundup-2026=database-backed event detail and dedicated native ticket selector; multiple tickets go directly to ticket Stripe Checkout and never enter the merch cart; no booking fee
/account/signup,/account/login,/account/forgot-password,/account/reset-password=customer account lifecycle with required verified email; the post-signup page holds a one-time hashed handoff token, polls while open, and signs the original browser in after verification on the same or another device
/account=full authenticated customer profile with editable display name, verified-email/security details, account age, ticket wallet/history and QR/PDF links, safe Good Game merch-order history, prominent available/reserved 20% ticket-holder perk, staff/admin shortcuts where authorized, logout, and support links; a Good Game history outage degrades only that section
/account/orders/:id=owner/staff ticket detail, QR display, printable PDF download
/tickets/confirmation=Stripe return page polling webhook fulfilment status
/admin=staff/admin testing control centre for metrics, automatic tier status, ticket purchases excluding expired checkouts, ticket-email delivery states (queued/sending/retrying/sent/failed), Stripe events, ticket resend, active-campaign Meta analytics with combined/per-campaign tabs, scanner access at the bottom, and an admin-only Testing purchase simulator
/admin/check-in=staff/admin camera QR and manual ticket-number check-in
/merch=server-rendered live Good Game catalogue grid followed by the ticket-holder 20% merch promo; friendly empty/error placeholder
/merch/[slug]=server-rendered product gallery, description, price, options, quantity, add-to-cart; missing product -> Next notFound
/cart=client cart review, canonical refresh, cancellation notice, totals, secure checkout
/cart/confirmation=Stripe return page; validates session_id shape; polls settlement; noindex
/socials=TikTok/Facebook/Instagram profile cards
/contact=social-profile contact links only; no contact form/email endpoint
/privacy=Meta advertising measurement disclosure and consent-management guidance

[api_routes]
POST_/api/signup=accept JSON or form email; trim/lowercase; regex validate; create `signups` table on demand; unique insert with ON CONFLICT DO NOTHING; consent-gated new signups send deduplicated Meta Lead CAPI event
POST_/api/auth/register=validated account creation; bcrypt cost 12; queues one-day verification link and returns a separate one-day signup-session handoff token
POST_/api/auth/login=verified-account login; opaque 30-day HttpOnly Secure SameSite=Lax database session
POST_/api/auth/logout=revokes current session
GET_/api/auth/verify=single-use email verification and signed-in redirect
POST_/api/auth/verification-session=same-origin one-time signup handoff; returns pending until the linked email is verified, then atomically consumes the hashed token and creates a 30-day HttpOnly session for the original browser
POST_/api/auth/forgot-password=enumeration-safe one-hour reset email request
POST_/api/auth/reset-password=single-use password replacement and all-session revocation
PATCH_/api/account/profile=same-origin authenticated display-name update; trims/collapses whitespace, enforces 2-80 characters, and never accepts email/role/security fields from the browser
POST_/api/tickets/checkout=authenticated server-priced pending ticket order with no public order/ticket number and a Stripe-hosted Checkout Session; availability changes only after verified payment
POST_/api/stripe/tickets-webhook=raw-body verified, livemode-guarded, idempotent native ticket fulfilment/refund processing; allocates the public UFI order number and individual UFI-T ticket numbers only after verified payment
GET_/api/tickets/orders/:id/pdf=owner/staff single printable order PDF with one page and one unique QR per admission ticket
POST_/api/admin/check-in=staff-only atomic one-use QR/manual ticket check-in
PATCH_/api/admin/ticket-types/:id=deprecated guard returning 409 because tier activation is automatic
POST_/api/admin/simulated-purchase=admin-only and APP_ENV=testing-only purchase simulator; uses real order/ticket/PDF/email fulfilment without calling Stripe
POST_/api/admin/orders/:id/resend=staff-only confirmation email requeue
POST_/api/merch/cart=public dynamic canonical cart refresh with optional account session enrichment; fetch Good Game catalogue no-store; drop unknown/unavailable variants; cap each quantity 1..20; return canonical display lines + removed count/IDs and the signed-in account's available/reserved one-time 20% ticket-holder discount summary
POST_/api/merch/checkout=node runtime; same-origin guard; validate numeric variant IDs and quantity 1..20; validate `ufi_<uuid>` intent; resolve optional authenticated account UUID/email and only that account's usable entitlement; bind account/entitlement into the durable request hash; reserve/rate-limit in Postgres; HMAC-sign the server-owned account/checkout request to Good Game; return upstream Stripe Checkout URL/payload and persist discount-session reconciliation
GET_/api/merch/confirmation=node dynamic; validate Stripe session id `cs_...`; HMAC-sign Good Game lookup; return safe upstream confirmation payload; paid consented sessions send deduplicated Meta Purchase CAPI event
POST_/api/merch/revalidate=node runtime; Good Game callback; read exact raw body; require timestamp within 300 seconds + constant-time HMAC; invalidate merch tag/path

[site_content_sources]
navigation_and_socials=frontend-next/lib/site.ts
TikTok=https://www.tiktok.com/@upforit.events handle @upforit.events
Facebook=https://www.facebook.com/up4ituk handle @up4ituk
Instagram=https://www.instagram.com/up_for_it_events_uk handle @up_for_it_events_uk
event_content=hard-coded in frontend-next/app/events/page.tsx
summer_roundup_detail_content=database-backed event title, date, time, venue and ticket tiers combined with flyer-authored genres, artist lineup, MC lineup, venue address and Revolt Sound System branding in frontend-next/app/events/[slug]/page.tsx
footer_year=hard-coded 2026
contact_method=social links only

[visual_system]
source=frontend-next/app/globals.css + frontend-next/components/PopArtScene.tsx
tokens=ink #050505; paper #ffffff; blue #008ef0; blue-light #29c6f5; blue-deep #0065d9; yellow #ffdf00; pink #d90062; muted #dfeef8
style=bold pop-art/comic; thick black borders; offset shadows; halftone/radial blue scene; pink/yellow accents; rotated cards/stickers
event_ticket_selector=Summer Roundup ticket module uses a cyan radial/halftone field, heavy outlined white/yellow tier panels, global heavy uppercase tier typography, and diagonal pink `Coming soon` ribbons over upcoming tiers
event_page_eyebrow=the Events landing card uses the enlarged native `UPFORIT presents` sticker with a yellow field, black border, black text and pink offset shadow; the Summer Roundup detail hero uses the extracted final-flyer presents artwork; the Home card retains its separate compact treatment
ticket_merch_promo=home, Events, merch and ticket selector surfaces use one responsive pink/yellow/cyan halftone sticker banner with the solid parallax-smiley asset on desktop, thick black borders, offset shadows, `20% off all merch!` headline and smaller any-UpForIt-event ticket condition; mobile hides the decorative smiley and compact banners collapse to one text column; cart recap uses the same visual language for the qualified-account discount state
event_ticket_summary=Summer Roundup detail and Events listing use equal-height, horizontally aligned date/time/venue cards with distinct yellow/pink/white fields, heavy typography and compact comic-banner labels; the detail-page venue card also shows the street address
event_ticket_mobile_order=at 720px and below the ticket selector appears before the stacked date/time/venue cards; desktop retains the aligned summary cards before ticket selection
event_ticket_frame=Summer Roundup detail uses the extracted cyan flyer background inside a black outer frame without offset colour strokes; the final-flyer presents/title, lineup, MC, Revolt, cloud and lightning assets are composed as responsive page elements; the genre strip is hidden on mobile, the title lockup is lowered to clear the presents/cloud artwork, and ticket/perk headings are centred
events_listing_frame=the Home and Events page Summer Roundup cards share the extracted final-flyer cyan background, presents/title lockup, cloud, lightning and comic date/time/venue styling in place of the former dark radial field and legacy combined wordmark; mobile uses an inset inner gutter for all card elements and retains the desktop-style transparent availability strip with pink stars and yellow divider lines; the Buy tickets action opens the event detail at the top without a section hash
ticket_confirmation_mobile=paid ticket confirmation message and order number are centred with clear vertical spacing before the full-width mobile View tickets action
ticket_wallet_qr=account wallet QR images preserve a strict 1:1 square aspect ratio at every breakpoint
responsive_breakpoints=900px,760px,720px,430px
motion=PopArtScene scroll parallax; desktop direct and mobile eased; disabled for prefers-reduced-motion
header=sticky; hides after 16px accumulated downward scroll; reappears upward/top/focus; mobile menu locks body and closes on Escape/route change
cart_drawer=right fixed panel + backdrop; body lock; Escape/backdrop close
accessibility=semantic headings/landmarks; focus-visible ring; aria labels/current state; reduced-motion support; cart/confirmation noindex where appropriate

[brand_assets]
module=frontend-next/lib/cloudinary.ts
cloud_name=brandduk
delivery_base=https://res.cloudinary.com/brandduk/image/upload
site_assets=navLogo WHITE_LOGO_WEB_filqtw; roundLogo NEW_ROUND_LOGO_amtvr0; smiley SOLID_SMILEY_taznwv; summerRoundup SUMMER_ROUND_UP_e2jcsl; final flyer elements UPFORIT/summer-roundup-2026-background, UPFORIT/summer-roundup-2026-presents, UPFORIT/summer-roundup-2026-title, UPFORIT/summer-roundup-2026-lineup, UPFORIT/summer-roundup-2026-mcs, UPFORIT/summer-roundup-2026-revolt, UPFORIT/summer-roundup-2026-cloud, UPFORIT/summer-roundup-2026-lightning
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
POST_/api/standalone-storefronts/upforit/customer-orders=HMAC required; accepts only the authenticated UpForIt server's account UUID plus verified normalized email in the signed JSON body so identity never appears in request URLs, matches future account-bound checkouts and legacy same-email orders, and returns only order number/date/status/total plus safe line-item summaries; excludes raw order data, addresses, customer/payment identifiers, costs and admin fields

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
publication_side_effect=signed callback to UpForIt `/api/merch/revalidate`; product fetches retain a 60-second fallback while the `/merch` grid is no-store
existing_product_attachment=admin can attach Good Game product ID as draft; internal standalone marker added
authorization=Good Game admins only; regular creator sessions cannot forge standalone destination/header or publish
product_removal=hide/unpublish; do not delete product automatically

[merch_catalog_cache]
catalog_grid_fetch=Next dynamic render + no-store fetch; catalogue changes are visible on the next `/merch` request without a stale Next response
catalog_other_fetches=Next fetch revalidate 60 seconds; tag `upforit-merch`; no-store callers such as cart refresh remain canonical at request time
product_fetch=Next fetch revalidate 60 seconds; tags `upforit-merch`,`upforit-product:<slug>`
revalidation=callback invalidates shared `upforit-merch` tag and `/merch` layout; optional body productId also invalidates `upforit-product:<productId>`
implementation_note=specific callback tag uses product ID while product fetch tag uses slug; shared `upforit-merch` tag currently guarantees correctness; if shared invalidation is narrowed, reconcile ID/slug tagging first
cart_refresh=no-store catalogue read so cart prices/availability are canonical at refresh time

[product_page_logic]
available_variants=filter upstream variants where available=true
default_variant=first available
options=prefer upstream option definitions; otherwise derive Option 1/2/3 unique values
option_change=prefer variant preserving other selected option values; fall back to first available variant matching changed option
title_split=shared `splitMerchProductTitle` helper splits on `|`; first segment is the main title and remaining segments form the smaller product-type subtitle
quantity_selector=absent on product page; each add action adds one unit and quantity is adjusted in cart
line_image=variant image ID match else first product image
unavailable_state=no available variant -> Currently unavailable; no add button

[cart_contract]
storage_key=upforit.merch.cart.v1 in localStorage
stored_shape=productId,productKind,variantId,slug,title,variantLabel,imageUrl,priceMinor,currency,quantity
title_display=drawer and full cart use the shared product-title split; separator hidden and product-type subtitle shown beneath the main title
storage_security=display cache only; never authoritative for price/availability/checkout
hydrate=normalize numeric variant IDs; quantity cap 1..20; fetch canonical cart once after restore
hydrate_failure=retain normalized stored lines and log generic warning; later cart-page refresh/Good Game checkout still fail closed against canonical state
add_same_variant=merge quantity; cap total 20; open drawer
remove=quantity below 1 or explicit Remove deletes line
count=sum quantities
cart_page_refresh=once on mount; replaces all lines with canonical response; unavailable lines removed with notice; refresh error shown
display_total=sum canonical/refreshed line priceMinor*quantity; delivery displayed separately
ticket_discount_display=authenticated usable entitlement shows original merch subtotal, `Ticket-holder discount (20%)`, discounted merch subtotal, unchanged delivery, and final total; amount is rounded in minor units from the canonical subtotal
shipping_copy=£2.99 for exactly one phone case at quantity one; £3.99 for all other products, quantities, and multi-line orders; UK only; display mirrors Good Game canonical checkout calculation

[checkout_intent_and_rate_limit]
intent_storage_key=upforit.merch.checkout-intent.v1 in sessionStorage
intent_format=ufi_<crypto.randomUUID()>
intent_reuse=same sorted variantId:quantity fingerprint reuses key; cart fingerprint change creates new key
request_hash=SHA-256 of sorted variantId:quantity entries plus the server-resolved entitlement id and authenticated account id when present
requester_hash=SHA-256(secret + resolved forwarded/client IP + first 240 user-agent chars); raw IP not stored
table=merch_checkout_requests; created on demand
table_columns=idempotency_key PK,request_hash,requester_hash,attempt_count,created_at,last_attempt_at
concurrency=Postgres transaction + requester advisory lock
idempotency_conflict=same key with different cart -> 409
rate_limit=maximum 8 new checkout intents per requester per 10 minutes; valid retries of same key do not count as new; 429 includes Retry-After 600
retention=opportunistically delete rows whose last_attempt_at is older than 7 days
database_failure=fail closed with 503; never bypass rate/idempotency guard

[checkout_flow]
1=cart page sends variant IDs + quantities + stable idempotency key and its displayed entitlement id to local `/api/merch/checkout`
2=local API validates shapes and same origin, resolves authenticated account UUID/verified email and that account's entitlement independently, binds both into the intent hash, reserves intent, derives current request origin, and builds success/cancel URLs
3=local API signs the exact JSON body with optional server-owned `customerAccount` identity and `ticket-merch-20` entitlement and calls Good Game
4=Good Game independently loads canonical DB variants/prices/weights/availability, calculates UK shipping and calculates 20% from merch subtotal only
5=Good Game creates a 30-minute Stripe Checkout Session with a single-use exact amount-off coupon; a newer attempt expires the prior open discounted session; browser redirects to returned Stripe URL
6=Stripe collects email, phone, GB shipping address, billing address, payment details; UpForIt never receives card data
7=success returns `/cart/confirmation?session_id={CHECKOUT_SESSION_ID}`; cancel returns `/cart?checkout=cancelled`
8=confirmation proxy signs lookup; client polls every 1500ms up to 20 attempts; clear cart only when `paid=true`
9=if settlement still pending after polling, show preparation/email fallback; payment/order remain owned by Good Game

[shipping]
country=GB only via Stripe allowed countries
calculation=Good Game existing UK small-item/standard shipping helper; never calculate/trust shipping in browser
small_item_rule=£2.99 delivery applies only when the cart contains exactly one phone case at quantity one; all other products, multiple quantities, and multi-line orders use £3.99 delivery

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

[meta_ads_measurement]
consent_cookie=upforit_meta_consent; granted or denied for 180 days; Meta script and server events remain disabled until granted
browser_events=PageView,merch and ticket ViewContent,AddToCart,merch and ticket InitiateCheckout,newsletter Lead,merch and paid ticket Purchase
server_events=new newsletter Lead, paid merch Purchase, and real paid ticket Purchase; shared event_id deduplicates matching Pixel/CAPI events
user_data=email is normalised and SHA-256 hashed server-side for new Lead; `_fbp`,`_fbc`,IP,user-agent used only after consent
sensitive_url_rule=never send checkout session query parameters to Meta; confirmation pages scrub the browser URL before tracking
ticket_content_ids=ticket tier UUIDs are used consistently for ViewContent, InitiateCheckout and Purchase
ticket_purchase_rule=queue only after verified Stripe payment and never for admin simulation, failed, expired, cancelled, unpaid, or refunded orders
ticket_outbox=encrypted `meta_conversion_jobs` payload is inserted in the paid fulfilment transaction; the private worker delivers with stable event_id, bounded exponential retry, delivered/dead terminal states, and unique event-id deduplication
ticket_delivery_isolation=Meta network/configuration failure never rolls back or delays a paid order, issued tickets, tier progression, or confirmation email; the worker retries independently
ticket_refund_reporting=refunds void admission tickets and remain visible in Stripe/admin; automatic Meta Purchase reversal is intentionally absent and must be reconciled in Meta/Stripe reporting
ads_reporting=server-only last-30-day account Insights helper is visible on the authenticated staff/admin surface together with conversion outbox status
secrets_rule=only NEXT_PUBLIC_META_PIXEL_ID may reach client code; all access tokens and app credentials remain server-only and ignored locally

[database_runtime]
module=frontend-next/lib/db.ts
driver=pg Pool
pool_lifetime=development cached on globalThis; production creates module/runtime pool without global cache
production_tls=ssl rejectUnauthorized=false
schema_management=versioned SQL in frontend-next/migrations; npm run db:migrate uses a Postgres advisory lock; npm run db:seed:ticketing idempotently seeds prices/capacities and advances rather than regresses the current tier
tables_owned_here=signups,merch_checkout_requests,merch_discount_entitlements,merch_discount_sync_jobs,users,user_sessions,auth_tokens,auth_rate_limits,events,ticket_types,ticket_orders,ticket_order_items,tickets,stripe_event_receipts,email_jobs,meta_conversion_jobs,ticket_audit_log,schema_migrations
tables_not_owned_here=products,variants,orders,checkout sessions,stock,fulfilment,email events; all Good Game

[native_ticket_sales]
prices=Early Bird £5; General Release £7.50; On The Door £10; exact displayed total with no booking fee
progression=Early Bird is capped at 50 paid tickets; General Release then activates for 100 paid tickets; On The Door then activates with no capacity limit
concurrency=checkout and admin simulation lock tier rows and count paid tickets only; open or abandoned Stripe Checkout Sessions never reduce availability
checkout_price_lock=the tier and unit price are snapshotted when the dedicated ticket Stripe Checkout Session is created; that session keeps its original price if the sale advances before payment
checkout_overrun=simultaneous successful payments may take a capped price tier slightly above its nominal paid-ticket threshold; those payments are honoured and the sale advances monotonically
monotonicity=once the sale advances to a later tier it does not reopen a cheaper tier after refunds
customer_flow=/events Buy tickets -> dedicated ticket selector -> required verified account -> native ticket Stripe Checkout -> webhook fulfilment -> email/PDF/QR -> persistent account wallet
ticket_merch_discount=first real paid ticket order grants one lifetime account entitlement regardless of ticket quantity; later ticket orders never grant another; the entitlement persists until redeemed, is revoked if its source ticket order is fully refunded while unused, excludes delivery, never stacks, and is not reissued after a merch refund; admin simulation does not qualify
ticket_merch_discount_backfill=scottcharles.rework@gmail.com receives one available entitlement from the earliest paid ticket order during migration 004
cart_isolation=native tickets never enter the Good Game merch cart; merch and tickets always use separate checkout sessions
quantity_ui=active ticket tier starts at quantity 1 and uses accessible left/right stepper buttons; customers may decrease to 0 or increase to the tier availability/per-order limit
admin_simulation=Testing admin can create one or more paid-equivalent tickets for their own admin account; fulfilment and email are real, Stripe payment is skipped, and the order is visibly marked as a simulation in admin
multi_ticket_email=one confirmation email is queued per order; it contains one PDF attachment for the complete order, with one full page and one unique QR code per admission ticket
multi_ticket_account=account order summary shows the ticket count; order detail uses a compact responsive ticket grid with Ticket N of total labels and a single Download all tickets PDF action
account_merch_history=UpForIt stores no merch orders; the dynamic account page HMAC-requests Good Game using the signed-in account UUID and verified normalized email, strictly normalizes the already-safe response again, and shows the history as read-only customer summaries with Good Game fulfilment attribution
account_profile_update=display name is the only editable local profile field; email remains read-only because it is the verified sign-in and legacy merch ownership key, while password replacement continues through the enumeration-safe email reset flow

[security]
server_only_modules=lib/merch.ts and lib/merch-checkout-guard.ts import server-only
hmac=SHA-256; exact timestamp/method/path/body binding; revalidation comparison constant-time; 300-second inbound callback tolerance
checkout_validation=local shape/same-origin/account-entitlement validation + Good Game canonical validation and entitlement lock; browser price/percentage/eligibility ignored
return_urls=derived from request origin and upstream allowlisted against registered UpForIt origin
session_id_validation=`^cs_[A-Za-z0-9_]+$`
cart_ids=numeric variant IDs only
quantity_limits=1..20 API/cart; product selector 1..5 per click
payment_data=Stripe hosted; no card storage/handling in UpForIt
known_absence=signup endpoint has no explicit rate limiter/CAPTCHA/consent checkbox
auth_form_async_safety=authentication forms retain the submitted form element before awaiting network requests so post-success reset does not dereference React event currentTarget

[seo_and_indexing]
canonical_origin=www
root_and_static_pages=per-page Metadata canonical values
product_metadata=dynamic title/description/canonical/OpenGraph primary image from Good Game product
cart_and_confirmation=robots noindex,nofollow
sitemap=absent
robots_file=absent
analytics=consent-gated Meta Pixel plus server-side Meta CAPI and authenticated Ads Insights reporting
cookie_banner=present; Accept/Decline choice persists for 180 days and Decline/revoke deletes `_fbp` and `_fbc`

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
check_6=Good Game merch Stripe webhook remains enabled; native ticket Stripe uses its separate UpForIt ticket webhook and must not process merch
check_7=confirmation returns paid status/UFI number before cart clears
check_8=verify order in Good Game LIVE admin and verify lifecycle email/stock update

[operational_playbook_domain]
canonical=https://www.upforitevents.co.uk
www=direct Railway custom domain
apex=Cloudflare proxied placeholder A record plus 301 redirect rule to www preserving path/query
do_not=replace the Cloudflare apex redirect placeholder with old hosting A records or expose SendGrid/Microsoft DNS records through the proxy
verify=curl/dig both apex redirect and www 200; Cloudflare SSL mode Full, Universal SSL active, and Always Use HTTPS enabled

[change_ownership]
UpForIt_repo=site content, visual design, public routes, cart UX/local persistence, signed proxy endpoints, signup table/API, local checkout throttling, canonical/cache presentation
Good_Game_repo=product creator/admin collection, product/variant DB, mapping/publication, catalog API, canonical validation, shipping, Stripe, settlement, order number/admin, stock, fulfilment/refunds, transactional email
Cloudflare=authoritative DNS, apex-to-www redirect, proxy and edge TLS; SendGrid/Microsoft mail records remain DNS-only
GoDaddy=domain registration and Microsoft 365 mailbox reseller only
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
