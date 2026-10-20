# UPFORIT admin

## Ticket scanner

`/scan` accepts signed ticket QRs and ticket numbers without selecting an event. The ticket identifies its event; cancelled/completed/ended events, held/refunded orders and void tickets are rejected. Future-event scans are labelled rehearsals until two hours before the published start. An admission is locked and consumed once. Retrying an uncertain scan uses the same request ID and returns its original success only to the same authenticated principal.

Admins use their existing dedicated-admin login. Door devices use the existing scanner enrolment/session tables and a separate host-only, HttpOnly, Strict cookie. The scanner's device controls choose the current/next event automatically for session expiry only; devices can scan any otherwise eligible ticket. Existing devices need a new activation or relink on the admin host, because storefront cookies are not shared across hosts. Existing activation QR links forward their fragment access key to this host without exposing it to server logs. Device revocation and relinking preserve the shared audit trail.

Configure `TICKET_QR_SIGNING_SECRET` as a Railway reference to `FRONTEND.TICKET_QR_SIGNING_SECRET`; reference `TICKET_QR_PREVIOUS_SIGNING_SECRETS` too when rotation overlap is used. `APP_ENV` must match the ticket environment. Production storefront `/scan` forwards here. Other storefront environments retain their existing isolated scanner unless `ADMIN_SCANNER_ORIGIN` explicitly points at an admin instance using that environment's database and keys; never point Testing at production.

Run `DATABASE_URL=postgresql://...@127.0.0.1:PORT/postgres npm run test:scanner` for isolated HTTP/database checks. It creates and removes its own local database and does not call Stripe or SendGrid. `npm run check` includes scanner server/browser syntax and `npm test` includes QR compatibility checks. The camera decoder is served locally from the pinned `@zxing/browser` dependency.

Dedicated production admin service. Uses the existing UPFORIT PostgreSQL users, bcrypt passwords, sessions, ticketing, competition records and Meta credentials. Every API read, export and mutation requires a current verified, enabled administrator. Sessions use a separate host-only HttpOnly cookie, last 12 hours, and are invalidated on logout. Writes require the configured origin; sign-in and mutations are rate limited in PostgreSQL.

## Run

`npm ci`, then `npm start`. For local development set `DATABASE_URL`, `AUTH_RATE_LIMIT_SECRET`, `ADMIN_ORIGIN=http://localhost:4310`. The existing preview link and all sample records have been removed. `DB_SSL=true` enables database TLS for Railway. Production binds to `0.0.0.0:$PORT`; local development binds to loopback.

## Production

Railway project: UPFORIT Events (`f2b0b5dd-cc1f-4b80-b7bd-c0f3939ae013`). Environment: production (`9878dca0-f0ef-4e9c-8d1a-84fe67bef158`). Service: ADMIN (`170b96b4-a69b-4bba-88ac-0aa8106cc5c9`). URL: https://admin-production-7548.up.railway.app

Deploy only this directory with `railway up admin-service --path-as-root --project f2b0b5dd-cc1f-4b80-b7bd-c0f3939ae013 --environment 9878dca0-f0ef-4e9c-8d1a-84fe67bef158 --service 170b96b4-a69b-4bba-88ac-0aa8106cc5c9 --detach`. The service currently deploys from local source uploads. No storefront deployment is required.

Railway variables reference FRONTEND values: DATABASE_URL, AUTH_RATE_LIMIT_SECRET, EMAIL_JOB_ENCRYPTION_KEY and META_* analytics credentials. ADMIN_ORIGIN must exactly match the service's public URL. Password recovery links to the existing storefront account flow.

## Data management

Startup transactionally creates three additive tables under an advisory lock: `admin_signup_preferences`, `admin_mix_reviews`, `admin_audit_log`. No existing rows or storefront schemas are rewritten. Existing sign-ups default to Subscribed until explicitly changed. Use the Subscribed export filter for campaigns; the Email campaigns page uses this subscribed audience directly and additionally excludes campaign suppressions. Exports include a status column. The public sign-up endpoint does not undo an admin unsubscribe.

Mix edits and competition settings update existing tables and audit logs; review flags live in the new admin table. Dates are displayed in London time except settings inputs, explicitly labelled UTC to avoid daylight-saving ambiguity. Valid vote totals use the existing verified, enabled voter rules. Uploaded audio can be played; linked mixes open SoundCloud. Ticket confirmation resends enter the existing encrypted email queue. Ticket pricing remains governed by the storefront's release configuration. Orders show the latest 500 with the full count; other records and exports are complete. Meta reports campaigns and their effective lifecycle statuses for the last 30 days.

## Verification

`npm run check` and `npm test`. `node --env-file=../frontend-next/.env.local scripts/integration-test.mjs` uses and removes an isolated local test database; it refuses non-local database hosts. Covers login, access control, CSRF, persistence, CSV filtering, role revocation and logout. `scripts/production-check.mjs` verifies live schema compatibility read-only without printing credentials.


## Email campaigns

The Email campaigns page saves drafts and previews, snapshots subscribed recipients at send time, and records submission outcomes and SendGrid engagement events. Defaults: UPFORIT <info@upforitevents.co.uk>, 9 Bassett Court, Leighton Buzzard, LU7 1EH. The Blackley banner is served from `/assets/blackley-email-banner.png`.

Delivery requires `SENDGRID_API_KEY` and `SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY`. Configure a separate signed Event Webhook pointing to `https://admin-production-7548.up.railway.app/webhooks/sendgrid` for processed, delivered, open, click, bounce, dropped, deferred, spam_report, unsubscribe and group_unsubscribe. Preserve other brands’ existing webhooks. The server rejects unsigned events, verifies exact raw bytes, ignores unrelated campaigns and deduplicates `sg_event_id`. No event payloads, IPs or user agents are stored. Configure credentials only after approval for the production SendGrid connection.

Sending explicitly requires typing SEND and matching the reviewed audience count. Each message carries campaign/recipient custom arguments; the worker checks current subscription state again before delivery. One-click and confirmation-page unsubscribes feed the same suppression list. Campaign messages use the Email API allowance, not the separate Marketing Campaigns contact store. No contact import is required.

The queue survives restarts. Ambiguous delivery timeouts or interrupted claims become `unknown` and require manual SendGrid activity review; they are never auto-retried. Accepted submissions do not imply delivery. Rejected requests are `failed`; unsubscribed recipients are `skipped`. A campaign with failed/unknown submissions needs attention. Reports show unique recipient opens/clicks, per-link totals and recent events. Open rates may be inflated by privacy protection and bots. Reports cover campaigns sent through this admin; past external sends are not automatically backfilled.

Tests: `npm run check`, `npm test`, and the isolated local integration script. Integration coverage includes audience deduplication, exclusions, send confirmation/count races, concurrent claims, immutable queued campaigns, webhook deduplication, recipient attribution and unsubscribe persistence. No live emails are sent by tests.

## Page analytics

The Page & ad analytics screen reads Cloudflare Web Analytics browser page loads. It shows total page views, visits/entries, top 10 viewed pages and top 10 landing pages for rolling 24-hour, 7-day or 30-day windows. Landing pages are ranked separately by `sum.visits`, not page views. Cloudflare defines a visit as an external/missing-referrer entry; this is not a unique-person count or proof of Meta attribution. Daily buckets are UTC and boundary days are partial. Data may be sampled or delayed. Device/browser data and individual visitor records are not fetched.

Set these server-only Railway ADMIN variables:
- `CLOUDFLARE_ACCOUNT_ID`: the account containing this site's Web Analytics.
- `CLOUDFLARE_ANALYTICS_API_TOKEN`: token scoped to that account with Account Analytics: Read.
- Optional `CLOUDFLARE_ANALYTICS_HOSTS`: comma-separated exact hostnames; defaults to `upforitevents.co.uk,www.upforitevents.co.uk`.

First enable Cloudflare Web Analytics for the storefront and verify the beacon is installed (automatic injection requires an eligible proxied setup; otherwise install the provided snippet). DNS hosting by itself does not collect browser page loads. The reporting API cannot backfill views from before tracking was enabled. Avoid installing a second beacon if automatic injection is already working. No new tracking script is installed by this admin change.

`GET /api/traffic?days=7` requires the same live admin session/role check as every other data endpoint. Queries are hostname-scoped, bounded, cached for 60 seconds and concurrent reads are coalesced. Provider errors produce explicit unavailable states, not zero metrics; raw provider errors and credentials are never returned. The Cloudflare query was verified live for 1-, 7- and 30-day ranges on 2026-10-12. The dedicated UPFORIT Admin Analytics token has Account Analytics: Read permission and expires on 2027-10-13. Credentials are stored only in Railway ADMIN variables.

Meta remains a separate last-30-days campaign report, including paused campaigns. Authentication failures now identify an invalid/expired reporting token; permission/rate-limit failures have separate messages. Replace `META_MARKETING_API_ACCESS_TOKEN` at its FRONTEND source if ADMIN uses a Railway reference. Keep the pixel ID and Conversions API token separate. On 2026-10-12, a read-only request using the production ADMIN reporting token returned HTTP 401 / Meta code 190. Cloudflare dashboard inspection subsequently confirmed automatic Web Analytics is enabled for upforitevents.co.uk (site tag `d88dc8f4ab584d8eb8db99d4f621dcec`, account `02e2514e4c842dd143ee31eef13f81d6`), showing 14 page views and 12 visits over the preceding 24 hours.

Cloudflare references: https://developers.cloudflare.com/web-analytics/data-metrics/high-level-metrics/ and https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/.

Meta reporting was reconnected on 2026-10-12 with a validated token for UPFORIT Website, scoped to `ads_read` and `public_profile`, expiring 2026-12-11 at 22:16 UTC. The secret is stored at FRONTEND.META_MARKETING_API_ACCESS_TOKEN; ADMIN references it. Renew through the existing Marketing API use-case Tools screen before expiry. Pixel ID and Conversions API credentials are separate and were not changed.

## Admin ownership and Blackley’s Bucket

All future admin features belong in this dedicated service, not the frontend account-page admin. Production: https://admin-production-7548.up.railway.app/#bucket. Root `AGENTS.md` records this convention for future tasks.

Blackley’s Bucket reads the shared `bucket_entries` and `bucket_audit` tables installed by storefront migration `012_blackleys_bucket.sql`. The public signup API stays in the storefront; admin reads, CSV exports and live-draw mutations run here under the existing verified admin session, same-origin and rate-limit checks. Invalid/refunded/held tickets and disabled accounts are excluded. Draws serialize on the event row, skip absent names and cap confirmed slots at eight. The old storefront `/admin/bucket` redirects here; its admin API has been removed.

Ticket checkout recovery (20 October 2026): the Tickets & orders dialog offers “Check Stripe checkout” for pending orders. Configure `STRIPE_SECRET_KEY` using the Railway reference `${{FRONTEND.STRIPE_SECRET_KEY}}` in the same environment. Reconciliation never creates a checkout, charges a customer, or issues a refund. It verifies metadata, reference, amount and currency before associating a session, and records an audit entry. An absent session is released only after a complete Stripe listing and the last possible expiry; uncertain or incomplete results remain pending. This action shares the order advisory lock used by the storefront and worker.

Deploy migration `015_checkout_recovery_and_worker_health.sql` through the frontend/worker before deploying this admin revision. The tickets dashboard reports stale/erroring worker lanes and email jobs overdue by five minutes. The worker now retries lane-level failures and records a heartbeat only after successful work; maintenance also runs with `--email-only`.

## Real paid ticket rehearsal

Open `/ticket-test` from Tickets & orders → Live paid test. This uses live Stripe and real money, not the old simulation route. A verified, enabled administrator can buy only for their own account; POSTs retain exact-origin checks and per-admin rate limits. The price is read from the real ticket configuration (including the NYE four-for-three offer), and the admin must review the total and type LIVE PAYMENT. Public sales gates and event publication are unchanged. No marketing conversion consent is manufactured for these tests.

Set ADMIN `ADMIN_LIVE_TICKET_TESTS_ENABLED=true` only with `APP_ENV=production` and a live server-side Stripe key. The switch can disable new/retried test checkouts. Deploy migration `016_admin_live_ticket_tests.sql` and the compatible frontend/worker before enabling the admin. This feature requires those deployments because the normal fulfilment and maintenance paths must recognise the stored per-order authorisation.

The authorisation is created transactionally by the admin for one order, lasts one hour and cannot be supplied through public checkout or Stripe metadata. Its immutable Stripe session expires after 35 minutes. Cancellation, event expiry, ticket sales deadline, payment identity/amount/currency, previous holds and refund/dispute checks remain enforced. Retried submissions use the same Stripe idempotency key and parameters; after the safe creation window use the existing Check Stripe checkout action for reconciliation. The worker keeps an authorised draft-event checkout open. Successful payment goes through the normal signed Stripe webhook, ticket issuance, encrypted email job, production PDF/QR generation and SendGrid delivery. Return and downloads use the normal customer account routes; sign in to the storefront as the same admin account first.

The test page displays order/payment webhook state, issued admissions, email delivery status, merchandise entitlement and refund state. It links to customer tickets, the real scanner and the specific Stripe payment for a manual full refund. Paid test tickets are explicitly recognised by the scanner and consume admission even before event day, so duplicate rejection can be exercised. Ordinary future-event tickets retain rehearsal-only scanning. After a full refund webhook, test tickets are void and rejected. There is no reset or simulated paid state. These are real orders/revenue; refund after rehearsal. Provider accepted/sent is not evidence of inbox receipt; check the received email and its actual QR on a physical scanner.

Validation: run the existing admin HTTP/scanner suites and `DATABASE_URL=postgresql://...@127.0.0.1:PORT/postgres node --import tsx scripts/test-ticket-high-priority.ts --recovery --admin-live-test` from frontend-next. It uses disposable local SQL and a fake Stripe transport, generates a real multi-page PDF, decodes a real generated QR image, and checks fulfilment, email queue, scanning, refunds and unchanged closed sales. No real payment or outbound email is made by automated tests.

Overview and Analytics share a selectable 30-day KPI graph: page hits, visits, issued tickets, conversions (currently paid orders), net ticket revenue, email sign-ups and mix entries. Daily chart values use UTC with partial boundary days. Ticket and order series aggregate all matching database records, not the recent-order table limit; void tickets are excluded and refunds reduce revenue on the original payment day. Unavailable website reporting is distinct from zero traffic.
