/**
 * Aguarda PostgreSQL aceitar conexões (Swarm: app_setup sobe antes do postgres).
 * Uso: DATABASE_URL definida; node scripts/wait-for-db.js
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const postgres = require("postgres");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("wait-for-db: DATABASE_URL não definida");
  process.exit(1);
}

const maxAttempts = Number(process.env.WAIT_FOR_DB_ATTEMPTS ?? "60");
const delayMs = Number(process.env.WAIT_FOR_DB_DELAY_MS ?? "2000");

async function ping() {
  const sql = postgres(url, {
    max: 1,
    connect_timeout: 5,
    idle_timeout: 2,
  });
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

async function main() {
  for (let i = 1; i <= maxAttempts; i++) {
    if (await ping()) {
      console.log(`wait-for-db: PostgreSQL pronto (tentativa ${i}/${maxAttempts})`);
      process.exit(0);
    }
    console.log(`wait-for-db: aguardando PostgreSQL… ${i}/${maxAttempts}`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
  console.error(
    "wait-for-db: timeout — PostgreSQL não respondeu. Verifique o serviço postgres e DATABASE_URL."
  );
  process.exit(1);
}

main();
