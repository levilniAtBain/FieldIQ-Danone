/**
 * Run pending Drizzle migrations.
 * Called on container start: `npm run db:migrate`
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import path from "path";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log("🔄 Running migrations…");
  await migrate(db, {
    migrationsFolder: path.join(process.cwd(), "drizzle/migrations"),
  });
  console.log("✅ Migrations complete");
  await pool.end();
}

main().catch((e) => {
  console.error("❌ Migration failed:", e);
  process.exit(1);
});
