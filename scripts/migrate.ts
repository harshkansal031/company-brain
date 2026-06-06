import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: path.resolve(__dirname, "../.env") });
config({ path: path.resolve(__dirname, "../.env.local"), override: true });

const resolvedDatabaseUrl = process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL;
if (!resolvedDatabaseUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const databaseUrl: string = resolvedDatabaseUrl;

const migrationsDir = path.resolve(__dirname, "../migrations");
const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();

async function main() {
  const sql = postgres(databaseUrl, { prepare: false, max: 1 });
  try {
    for (const file of files) {
      const migrationSql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      console.log(`Applying ${file}...`);
      await sql.unsafe(migrationSql);
      console.log(`Applied ${file}`);
    }
    console.log("All migrations applied.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
