/**
 * Wrapper de `drizzle-kit migrate` com `pg_advisory_lock`.
 *
 * Em Swarm/Kubernetes, várias réplicas podem subir ao mesmo tempo e tentar
 * aplicar a mesma migration — race condition que pode corromper o schema
 * (`relation already exists` ainda no meio da criação, índices parciais, etc.).
 *
 * Este script:
 * 1. Abre uma conexão Postgres
 * 2. Pega um advisory lock global (`pg_advisory_lock(4242)`) — bloqueia até
 *    qualquer outra réplica que já esteja no migrate liberar
 * 3. Executa `npx drizzle-kit migrate` como subprocesso
 * 4. Libera o lock no `finally`
 * 5. Sai com o exit code do subprocesso (preserva CI)
 */
import "dotenv/config";
import postgres from "postgres";
import { spawn } from "node:child_process";

const ADVISORY_LOCK_ID = 4242; // arbitrário; usar o mesmo em todas as réplicas

async function main(): Promise<number> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[migrate-lock] DATABASE_URL não definida.");
    return 1;
  }

  const sql = postgres(url, { max: 1, idle_timeout: 5, connect_timeout: 10 });

  try {
    console.log(`[migrate-lock] pegando pg_advisory_lock(${ADVISORY_LOCK_ID})…`);
    // BLOQUEANTE: aguarda outra réplica liberar se já estiver migrando.
    await sql`SELECT pg_advisory_lock(${ADVISORY_LOCK_ID})`;
    console.log("[migrate-lock] lock obtido — executando drizzle-kit migrate");

    const exitCode = await runMigrate();
    console.log(`[migrate-lock] drizzle-kit migrate saiu com código ${exitCode}`);
    return exitCode;
  } finally {
    try {
      await sql`SELECT pg_advisory_unlock(${ADVISORY_LOCK_ID})`;
      console.log("[migrate-lock] lock liberado");
    } catch (err) {
      console.error("[migrate-lock] falha ao liberar lock:", err);
    }
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

function runMigrate(): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["drizzle-kit", "migrate"],
      { stdio: "inherit", env: process.env }
    );
    child.on("exit", (code) => resolve(typeof code === "number" ? code : 1));
    child.on("error", (err) => {
      console.error("[migrate-lock] spawn error:", err);
      resolve(1);
    });
  });
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("[migrate-lock] unhandled error:", err);
    process.exit(1);
  });
