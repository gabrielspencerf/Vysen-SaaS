/**
 * Garante que a coluna currency_code existe em google_ads_accounts.
 * Use se o erro "não existe a coluna currency_code" persistir após db:migrate.
 * Uso: npx tsx scripts/ensure-currency-code.ts
 */
import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida.");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function main() {
  try {
    await sql.unsafe(`
      ALTER TABLE google_ads_accounts
      ADD COLUMN IF NOT EXISTS currency_code varchar(8);
    `);
    console.log("Coluna currency_code verificada/criada em google_ads_accounts.");
  } catch (err) {
    console.error("Erro:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
