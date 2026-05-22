/**
 * Cliente Drizzle em runtime — acesso ao PostgreSQL.
 * Schema e migrations ficam em db/; aqui apenas a conexão e o cliente.
 *
 * Em desenvolvimento Next.js, o módulo pode ser re-executado a cada HMR;
 * o singleton em globalThis evita múltiplas conexões (evita "too many clients").
 *
 * Durante `runWithRlsContext`, `getDb()` devolve o cliente da transação ativa
 * (AsyncLocalStorage), evitando mistura de GUCs RLS entre requisições concorrentes
 * na mesma conexão.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { tenantDbAsyncLocalStorage } from "./tx-context";
import type { AppDatabase } from "./tx-context";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL não definida. Configure em .env.local");
}

function parsePoolMax(): number {
  const raw = process.env.DATABASE_POOL_MAX;
  if (raw === undefined || raw === "") {
    return process.env.NODE_ENV === "production" ? 12 : 6;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 6;
  return Math.min(50, Math.floor(n));
}

function parsePositiveMs(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

declare global {
  // eslint-disable-next-line no-var
  var __dbRoot: AppDatabase | undefined;
}

function createRootDb(): AppDatabase {
  // Timeouts evitam que uma query travada ou transação esquecida segure um slot
  // do pool indefinidamente. Em produção, libera o slot em ~30s/60s.
  const statementTimeoutMs = parsePositiveMs("DATABASE_STATEMENT_TIMEOUT_MS", 30_000);
  const idleInTxTimeoutMs = parsePositiveMs(
    "DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS",
    60_000
  );
  const client = postgres(connectionString!, {
    max: parsePoolMax(),
    idle_timeout: 20,
    connect_timeout: 10,
    connection: {
      statement_timeout: statementTimeoutMs,
      idle_in_transaction_session_timeout: idleInTxTimeoutMs,
    },
  });
  return drizzle(client, { schema });
}

let _dbRoot: AppDatabase | undefined;

export function getRootDb(): AppDatabase {
  if (process.env.NODE_ENV !== "production") {
    if (!globalThis.__dbRoot) globalThis.__dbRoot = createRootDb();
    return globalThis.__dbRoot;
  }
  if (!_dbRoot) _dbRoot = createRootDb();
  return _dbRoot;
}

/**
 * Cliente Drizzle: transação RLS (quando ativa) ou pool raiz.
 */
export function getDb(): AppDatabase {
  return tenantDbAsyncLocalStorage.getStore() ?? getRootDb();
}

/**
 * Cliente singleton para uso em API routes e server code.
 * Preferir getDb() em código que pode rodar em contexto de script (ex.: seed).
 */
export const db = getRootDb();

export type Database = AppDatabase;
