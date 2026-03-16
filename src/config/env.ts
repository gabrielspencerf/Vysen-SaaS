/**
 * Validação e leitura de variáveis de ambiente (server-only onde fizer sentido).
 * Base 1: variáveis obrigatórias para app e worker.
 */

function getEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    throw new Error(`Variável de ambiente obrigatória ausente: ${key}`);
  }
  return value;
}

function getEnvOptional(key: string): string | undefined {
  return process.env[key];
}

export const env = {
  get databaseUrl(): string {
    return getEnv("DATABASE_URL");
  },

  get redisUrl(): string {
    return getEnv("REDIS_URL");
  },

  get sessionCookieName(): string {
    return getEnvOptional("SESSION_COOKIE_NAME") ?? "session";
  },

  get sessionSecret(): string {
    return getEnv("SESSION_SECRET");
  },

  get nodeEnv(): string {
    return getEnvOptional("NODE_ENV") ?? "development";
  },

  get appUrl(): string | undefined {
    return getEnvOptional("NEXT_PUBLIC_APP_URL");
  },

  get isDev(): boolean {
    return this.nodeEnv === "development";
  },

  /** Autenticação por conta (Google Ads): quando true, o botão "Conectar nova conta" fica ativo. */
  get googleAdsConnectEnabled(): boolean {
    return getEnvOptional("GOOGLE_ADS_CONNECT_ENABLED") === "true";
  },
} as const;
