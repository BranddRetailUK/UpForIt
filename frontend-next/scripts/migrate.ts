import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { getPool } from "../lib/db";

async function main() {
  const migrationsDirectory = path.join(process.cwd(), "migrations");
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("SELECT pg_advisory_lock($1)", [742026]);
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
    );

    for (const file of migrationFiles) {
      const exists = await client.query<{ version: string }>(
        "SELECT version FROM schema_migrations WHERE version = $1",
        [file]
      );
      if (exists.rowCount) continue;

      const sql = await readFile(path.join(migrationsDirectory, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`Applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [742026]).catch(() => undefined);
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

