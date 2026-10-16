# UPFORIT admin

Dedicated production admin service. Uses the existing UPFORIT PostgreSQL users, bcrypt passwords, sessions, ticketing, competition records and Meta credentials. Every API read, export and mutation requires a current verified, enabled administrator. Sessions use a separate host-only HttpOnly cookie, last 12 hours, and are invalidated on logout. Writes require the configured origin; sign-in and mutations are rate limited in PostgreSQL.

## Run

`npm ci`, then `npm start`. For local development set `DATABASE_URL`, `AUTH_RATE_LIMIT_SECRET`, `ADMIN_ORIGIN=http://localhost:4310`. The existing preview link and all sample records have been removed. `DB_SSL=true` enables database TLS for Railway. Production binds to `0.0.0.0:$PORT`; local development binds to loopback.

## Production

Railway project: UPFORIT Events (`f2b0b5dd-cc1f-4b80-b7bd-c0f3939ae013`). Environment: production (`9878dca0-f0ef-4e9c-8d1a-84fe67bef158`). Service: ADMIN (`170b96b4-a69b-4bba-88ac-0aa8106cc5c9`). URL: https://admin-production-7548.up.railway.app

Deploy only this directory with `railway up admin-service --path-as-root --project f2b0b5dd-cc1f-4b80-b7bd-c0f3939ae013 --environment 9878dca0-f0ef-4e9c-8d1a-84fe67bef158 --service 170b96b4-a69b-4bba-88ac-0aa8106cc5c9 --detach`. The service currently deploys from local source uploads. No storefront deployment is required.

Railway variables reference FRONTEND values: DATABASE_URL, AUTH_RATE_LIMIT_SECRET, EMAIL_JOB_ENCRYPTION_KEY and META_* analytics credentials. ADMIN_ORIGIN must exactly match the service's public URL. Password recovery links to the existing storefront account flow.

## Data management

Startup transactionally creates three additive tables under an advisory lock: `admin_signup_preferences`, `admin_mix_reviews`, `admin_audit_log`. No existing rows or storefront schemas are rewritten. Existing sign-ups default to Subscribed until explicitly changed. Use the Subscribed export filter for campaigns; the Email campaigns page uses this subscribed audience directly and additionally excludes campaign suppressions. Exports include a status column. The public sign-up endpoint does not undo an admin unsubscribe.

Mix edits and competition settings update existing tables and audit logs; review flags live in the new admin table. Dates are displayed in London time except settings inputs, explicitly labelled UTC to avoid daylight-saving ambiguity. Valid vote totals use the existing verified, enabled voter rules. Uploaded audio can be played; linked mixes open SoundCloud. Ticket confirmation resends enter the existing encrypted email queue. Ticket pricing remains governed by the storefront's release configuration. Orders show the latest 500 with the full count; other records and exports are complete. Meta reports currently active campaigns for the last 30 days, matching the existing admin's scope.

## Verification

`npm run check` and `npm test`. `node --env-file=../frontend-next/.env.local scripts/integration-test.mjs` uses and removes an isolated local test database; it refuses non-local database hosts. Covers login, access control, CSRF, persistence, CSV filtering, role revocation and logout. `scripts/production-check.mjs` verifies live schema compatibility read-only without printing credentials.


## Email campaigns

The Email campaigns page saves drafts and previews, snapshots subscribed recipients at send time, and records submission outcomes and SendGrid engagement events. Defaults: UPFORIT <info@upforitevents.co.uk>, 9 Bassett Court, Leighton Buzzard, LU7 1EH. The Blackley banner is served from `/assets/blackley-email-banner.png`.

Delivery requires `SENDGRID_API_KEY` and `SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY`. Configure a separate signed Event Webhook pointing to `https://admin-production-7548.up.railway.app/webhooks/sendgrid` for processed, delivered, open, click, bounce, dropped, deferred, spam_report, unsubscribe and group_unsubscribe. Preserve other brands’ existing webhooks. The server rejects unsigned events, verifies exact raw bytes, ignores unrelated campaigns and deduplicates `sg_event_id`. No event payloads, IPs or user agents are stored. Configure credentials only after approval for the production SendGrid connection.

Sending explicitly requires typing SEND and matching the reviewed audience count. Each message carries campaign/recipient custom arguments; the worker checks current subscription state again before delivery. One-click and confirmation-page unsubscribes feed the same suppression list. Campaign messages use the Email API allowance, not the separate Marketing Campaigns contact store. No contact import is required.

The queue survives restarts. Ambiguous delivery timeouts or interrupted claims become `unknown` and require manual SendGrid activity review; they are never auto-retried. Accepted submissions do not imply delivery. Rejected requests are `failed`; unsubscribed recipients are `skipped`. A campaign with failed/unknown submissions needs attention. Reports show unique recipient opens/clicks, per-link totals and recent events. Open rates may be inflated by privacy protection and bots. Reports cover campaigns sent through this admin; past external sends are not automatically backfilled.

Tests: `npm run check`, `npm test`, and the isolated local integration script. Integration coverage includes audience deduplication, exclusions, send confirmation/count races, concurrent claims, immutable queued campaigns, webhook deduplication, recipient attribution and unsubscribe persistence. No live emails are sent by tests.

## Page analytics

The Page & ad analytics screen reads Cloudflare Web Analytics browser page loads. It shows total page views, visits/entries, daily views, top 10 viewed pages and top 10 landing pages for rolling 24-hour, 7-day or 30-day windows. Landing pages are ranked separately by `sum.visits`, not page views. Cloudflare defines a visit as an external/missing-referrer entry; this is not a unique-person count or proof of Meta attribution. Daily buckets are UTC and boundary days are partial. Data may be sampled or delayed. Device/browser data and individual visitor records are not fetched.

Set these server-only Railway ADMIN variables:
- `CLOUDFLARE_ACCOUNT_ID`: the account containing this site's Web Analytics.
- `CLOUDFLARE_ANALYTICS_API_TOKEN`: token scoped to that account with Account Analytics: Read.
- Optional `CLOUDFLARE_ANALYTICS_HOSTS`: comma-separated exact hostnames; defaults to `upforitevents.co.uk,www.upforitevents.co.uk`.

First enable Cloudflare Web Analytics for the storefront and verify the beacon is installed (automatic injection requires an eligible proxied setup; otherwise install the provided snippet). DNS hosting by itself does not collect browser page loads. The reporting API cannot backfill views from before tracking was enabled. Avoid installing a second beacon if automatic injection is already working. No new tracking script is installed by this admin change.

`GET /api/traffic?days=7` requires the same live admin session/role check as every other data endpoint. Queries are hostname-scoped, bounded, cached for 60 seconds and concurrent reads are coalesced. Provider errors produce explicit unavailable states, not zero metrics; raw provider errors and credentials are never returned. The Cloudflare query was verified live for 1-, 7- and 30-day ranges on 2026-10-12. The dedicated UPFORIT Admin Analytics token has Account Analytics: Read permission and expires on 2027-10-13. Credentials are stored only in Railway ADMIN variables.

Meta remains a separate last-30-days active-campaign report. Authentication failures now identify an invalid/expired reporting token; permission/rate-limit failures have separate messages. Replace `META_MARKETING_API_ACCESS_TOKEN` at its FRONTEND source if ADMIN uses a Railway reference. Keep the pixel ID and Conversions API token separate. On 2026-10-12, a read-only request using the production ADMIN reporting token returned HTTP 401 / Meta code 190. Cloudflare dashboard inspection subsequently confirmed automatic Web Analytics is enabled for upforitevents.co.uk (site tag `d88dc8f4ab584d8eb8db99d4f621dcec`, account `02e2514e4c842dd143ee31eef13f81d6`), showing 14 page views and 12 visits over the preceding 24 hours.

Cloudflare references: https://developers.cloudflare.com/web-analytics/data-metrics/high-level-metrics/ and https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/.

Meta reporting was reconnected on 2026-10-12 with a validated token for UPFORIT Website, scoped to `ads_read` and `public_profile`, expiring 2026-12-11 at 22:16 UTC. The secret is stored at FRONTEND.META_MARKETING_API_ACCESS_TOKEN; ADMIN references it. Renew through the existing Marketing API use-case Tools screen before expiry. Pixel ID and Conversions API credentials are separate and were not changed.

## Admin ownership and Blackley’s Bucket

All future admin features belong in this dedicated service, not the frontend account-page admin. Production: https://admin-production-7548.up.railway.app/#bucket. Root `AGENTS.md` records this convention for future tasks.

Blackley’s Bucket reads the shared `bucket_entries` and `bucket_audit` tables installed by storefront migration `012_blackleys_bucket.sql`. The public signup API stays in the storefront; admin reads, CSV exports and live-draw mutations run here under the existing verified admin session, same-origin and rate-limit checks. Invalid/refunded/held tickets and disabled accounts are excluded. Draws serialize on the event row, skip absent names and cap confirmed slots at eight. The old storefront `/admin/bucket` redirects here; its admin API has been removed.
