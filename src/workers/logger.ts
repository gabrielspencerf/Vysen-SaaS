/**
 * Logger JSON-line para o worker, com correlação automática.
 *
 * Sem dep externa (sem pino/winston): cada chamada serializa uma linha JSON
 * no stdout/stderr com campos uniformes — fácil de parsear em qualquer
 * agregador (Loki, ELK, Datadog, CloudWatch).
 *
 * Campos sempre presentes:
 * - ts: timestamp ISO
 * - level: "debug" | "info" | "warn" | "error"
 * - service: "worker"
 * - instance: hostname/pod id (de workerInstanceId)
 * - msg: mensagem humana
 *
 * Contexto adicional (jobId, tenantId, queueName, attempt, error, etc.) entra
 * como campos top-level no JSON pra facilitar busca/filtro.
 */
import { workerInstanceId } from "./readiness";

type LogLevel = "debug" | "info" | "warn" | "error";

const SERVICE = "worker";
const INSTANCE = workerInstanceId();

// Filtro de nível via env. "info" em prod por default; pode subir pra "warn"
// se logs estiverem muito barulhentos.
const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL: LogLevel = ((process.env.WORKER_LOG_LEVEL?.toLowerCase() as LogLevel) || "info");

export interface LogContext {
  jobId?: string | null;
  tenantId?: string | null;
  queueName?: string;
  dlqName?: string;
  jobType?: string;
  attempt?: number;
  conversationId?: string;
  rawEventId?: string;
  error?: string;
  /** Demais campos arbitrários (number/string/boolean). */
  [key: string]: unknown;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL];
}

function emit(level: LogLevel, msg: string, ctx?: LogContext): void {
  if (!shouldLog(level)) return;
  const payload = {
    ts: new Date().toISOString(),
    level,
    service: SERVICE,
    instance: INSTANCE,
    msg,
    ...(ctx ?? {}),
  };
  const line = JSON.stringify(payload);
  // error/warn vão pro stderr; resto pro stdout.
  if (level === "error" || level === "warn") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const workerLog = {
  debug: (msg: string, ctx?: LogContext) => emit("debug", msg, ctx),
  info: (msg: string, ctx?: LogContext) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext) => emit("error", msg, ctx),
};
