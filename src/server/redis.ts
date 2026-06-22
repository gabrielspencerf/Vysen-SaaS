/**
 * Cliente Redis para uso na app (ex.: enfileirar jobs após ingest de webhook).
 *
 * Dois modos:
 * - `getSharedRedis()` — singleton de processo. PREFIRA em hot paths (webhooks,
 *   ingest) para evitar handshake TLS por evento. Não chame `quit()`.
 * - `createRedisClient()` — conexão dedicada (rate-limit, locks longos). Caller
 *   é responsável por `quit()`.
 */

import Redis from "ioredis";

function getRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL não definida. Configure em .env.local");
  }
  return url;
}

declare global {
  var __sharedRedis: Redis | undefined;
}

function createInternal(): Redis {
  return new Redis(getRedisUrl(), {
    maxRetriesPerRequest: 2,
    connectTimeout: 5000,
    // Em hot paths a conexão fica viva muito tempo; manter lazy reconnect.
    enableOfflineQueue: true,
  });
}

let _sharedRedis: Redis | undefined;

/**
 * Cliente Redis compartilhado por processo. Reutiliza a conexão entre requests
 * (evita handshake TLS por evento em webhooks). NÃO chamar `quit()` no caller —
 * o processo encerra o cliente no shutdown.
 *
 * Em dev (HMR), guarda em globalThis para evitar múltiplas conexões a cada hot
 * reload.
 */
export function getSharedRedis(): Redis {
  if (process.env.NODE_ENV !== "production") {
    if (!globalThis.__sharedRedis) {
      globalThis.__sharedRedis = createInternal();
    }
    return globalThis.__sharedRedis;
  }
  if (!_sharedRedis) {
    _sharedRedis = createInternal();
  }
  return _sharedRedis;
}

/**
 * Cria um cliente Redis dedicado. O chamador deve chamar `redis.quit()` após o
 * uso. Prefira `getSharedRedis()` em hot paths.
 */
export function createRedisClient(): Redis {
  return createInternal();
}
