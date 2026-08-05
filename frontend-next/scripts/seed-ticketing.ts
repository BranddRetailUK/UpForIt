import { getPool } from "../lib/db";

const EVENT_ID = "4e37f654-31f8-4c86-a59e-bf4e72c7f0a1";
const TICKET_TYPES = [
  ["8756ca79-53f1-4dd1-9298-c07e85fd10e1", "Early Bird", 500, true, 10],
  ["8756ca79-53f1-4dd1-9298-c07e85fd10e2", "Tier 1", 750, false, 20],
  ["8756ca79-53f1-4dd1-9298-c07e85fd10e3", "Tier 2", 1000, false, 30]
] as const;

async function main() {
  const pool = getPool();
  await pool.query(
    `INSERT INTO events (
       id, slug, title, description, image_url, venue_name, timezone, starts_at, ends_at, status
     ) VALUES ($1, 'summer-roundup-2026', 'The Summer Roundup',
       'UPFORIT presents The Summer Roundup: a full day of music and good vibes.',
       'https://res.cloudinary.com/brandduk/image/upload/v1785833927/UPFORIT_Summer_Round_Up_PP_hjq2nh.png',
       'McCarthys Sports Bar', 'Europe/London', '2026-09-26T11:00:00Z', '2026-09-26T22:00:00Z', 'published')
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title, description = EXCLUDED.description, image_url = EXCLUDED.image_url,
       venue_name = EXCLUDED.venue_name, starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at,
       status = EXCLUDED.status, updated_at = now()`,
    [EVENT_ID]
  );

  for (const [id, name, price, active, sortOrder] of TICKET_TYPES) {
    await pool.query(
      `INSERT INTO ticket_types (
         id, event_id, name, price_minor, currency, capacity, max_per_order, is_active, sort_order
       ) VALUES ($1, $2, $3, $4, 'gbp', NULL, 10, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, price_minor = EXCLUDED.price_minor, currency = EXCLUDED.currency,
         sort_order = EXCLUDED.sort_order, updated_at = now()`,
      [id, EVENT_ID, name, price, active, sortOrder]
    );
  }

  console.log("Seeded The Summer Roundup and confirmed ticket tiers.");
  await pool.end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
