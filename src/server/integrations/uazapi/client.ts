import { getDb } from "@/server/db";
import { uazapiInstances } from "@/db/schema";
import { decryptSecret } from "@/server/security/secret-crypto";
import type { ProviderStatusDetails } from "@/server/integrations/providers/types";
import { agentDebugLog } from "@/server/debug/agent-debug-log";
import {
  allowedHostsFromIntegrationBaseUrl,
  safeFetch,
} from "@/server/security/safe-fetch";

export interface UazapiInstanceStatus {
  instanceId: string;
  tenantId: string;
  provider: "uazapi";
  ok: boolean;
  status: string;
  latencyMs: number;
  details?: ProviderStatusDetails;
}

function getDatabaseHostSafe(): string {
  try {
    const raw = process.env.DATABASE_URL ?? "";
    if (!raw) return "missing";
    const parsed = new URL(raw);
    return parsed.host || "unknown-host";
  } catch {
    return "invalid-url";
  }
}

function isMissingTokenEncryptedColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message ?? "";
  return message.includes('coluna "token_encrypted"') || message.includes('column "token_encrypted"');
}

function resolveSecret(encrypted: string | null): string | null {
  if (!encrypted) return null;
  try {
    return decryptSecret(encrypted);
  } catch {
    return null;
  }
}

async function requestWithTimeout(
  url: string,
  baseUrl: string,
  init: RequestInit,
  timeoutMs: number
) {
  return safeFetch(url, {
    ...init,
    allowedHosts: allowedHostsFromIntegrationBaseUrl(baseUrl),
    timeoutMs,
    maxRedirects: 2,
  });
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

function buildHealthCandidates(baseUrl: string): string[] {
  const base = normalizeBaseUrl(baseUrl);
  return [`${base}/instance/status`, `${base}/health`, `${base}/`];
}

type ParsedUazapiCredential = {
  hasCredential: boolean;
  apiKey: string | null;
  token: string | null;
  adminToken: string | null;
  mode: "none" | "raw_api_key" | "query_string" | "json";
};

function parseUazapiCredential(raw: string | null): ParsedUazapiCredential {
  const value = raw?.trim() ?? "";
  if (!value) {
    return {
      hasCredential: false,
      apiKey: null,
      token: null,
      adminToken: null,
      mode: "none",
    };
  }

  if (value.startsWith("{") && value.endsWith("}")) {
    try {
      const parsed = JSON.parse(value) as {
        apiKey?: unknown;
        apikey?: unknown;
        token?: unknown;
        adminToken?: unknown;
        admintoken?: unknown;
      };
      const apiKey =
        typeof parsed.apiKey === "string" ? parsed.apiKey.trim()
        : typeof parsed.apikey === "string" ? parsed.apikey.trim()
        : null;
      const token = typeof parsed.token === "string" ? parsed.token.trim() : null;
      const adminToken =
        typeof parsed.adminToken === "string" ? parsed.adminToken.trim()
        : typeof parsed.admintoken === "string" ? parsed.admintoken.trim()
        : null;
      return {
        hasCredential: Boolean(apiKey || token || adminToken),
        apiKey: apiKey || null,
        token: token || null,
        adminToken: adminToken || null,
        mode: "json",
      };
    } catch {
      return {
        hasCredential: true,
        apiKey: value,
        token: null,
        adminToken: null,
        mode: "raw_api_key",
      };
    }
  }

  if (value.includes("=")) {
    const params = new URLSearchParams(value.replace(/[;,]/g, "&"));
    const apiKey = params.get("apikey")?.trim() || params.get("apiKey")?.trim() || null;
    const token = params.get("token")?.trim() || null;
    const adminToken = params.get("admintoken")?.trim() || params.get("adminToken")?.trim() || null;
    if (apiKey || token || adminToken) {
      return {
        hasCredential: true,
        apiKey,
        token,
        adminToken,
        mode: "query_string",
      };
    }
  }

  return {
    hasCredential: true,
    apiKey: value,
    token: value,
    adminToken: null,
    mode: "raw_api_key",
  };
}

function resolveRowCredential(row: {
  apiKeyEncrypted: string | null;
  tokenEncrypted: string | null;
  adminTokenEncrypted: string | null;
}): ParsedUazapiCredential {
  const legacyRaw = resolveSecret(row.apiKeyEncrypted);
  const legacy = parseUazapiCredential(legacyRaw);
  const token = resolveSecret(row.tokenEncrypted);
  const adminToken = resolveSecret(row.adminTokenEncrypted);

  const resolved: ParsedUazapiCredential = {
    hasCredential: Boolean(legacy.hasCredential || token || adminToken),
    apiKey: legacy.apiKey,
    token: token ?? legacy.token,
    adminToken: adminToken ?? legacy.adminToken,
    mode: token || adminToken ? "json" : legacy.mode,
  };
  return resolved;
}

function buildUazapiHeaders(auth: ParsedUazapiCredential): HeadersInit | undefined {
  if (!auth.hasCredential) return undefined;
  const headers: Record<string, string> = {};
  if (auth.apiKey) headers.apikey = auth.apiKey;
  if (auth.token) {
    headers.token = auth.token;
    headers.Authorization = `Bearer ${auth.token}`;
  }
  if (auth.adminToken) {
    headers.admintoken = auth.adminToken;
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
}

type UazapiAuthAttempt = {
  strategy: string;
  endpoint: string;
  headers?: HeadersInit;
};

function appendStatusParams(
  url: string,
  values: { token?: string | null; adminToken?: string | null }
): string {
  if (!url.endsWith("/instance/status")) return url;
  if (!values.token && !values.adminToken) return url;
  try {
    const parsed = new URL(url);
    if (values.token) parsed.searchParams.set("token", values.token);
    if (values.adminToken) parsed.searchParams.set("admintoken", values.adminToken);
    return parsed.toString();
  } catch {
    return url;
  }
}

function appendStatusParamsVariants(
  url: string,
  values: { token?: string | null; adminToken?: string | null }
): string[] {
  if (!url.endsWith("/instance/status")) return [url];
  const variants = new Set<string>();
  try {
    const build = (pairs: Array<[string, string | null | undefined]>) => {
      const parsed = new URL(url);
      for (const [key, value] of pairs) {
        if (value) parsed.searchParams.set(key, value);
      }
      variants.add(parsed.toString());
    };
    build([
      ["token", values.token],
      ["admintoken", values.adminToken],
    ]);
    build([
      ["token", values.token],
      ["adminToken", values.adminToken],
    ]);
    build([
      ["token", values.token],
      ["admin-token", values.adminToken],
    ]);
  } catch {
    variants.add(url);
  }
  return Array.from(variants);
}


function endpointForDetails(endpoint: string): string {
  try {
    const parsed = new URL(endpoint);
    parsed.search = "";
    return parsed.toString();
  } catch {
    return endpoint.split("?")[0] ?? endpoint;
  }
}

function buildAuthAttempts(candidate: string, auth: ParsedUazapiCredential): UazapiAuthAttempt[] {
  const isInstanceStatus = candidate.endsWith("/instance/status");
  const baseHeaders = buildUazapiHeaders(auth);
  const attempts: UazapiAuthAttempt[] = [];

  if (!isInstanceStatus) {
    attempts.push({
      strategy: "default_headers",
      endpoint: candidate,
      headers: baseHeaders,
    });
    return attempts;
  }

  const hasTokenPair = Boolean(auth.token || auth.adminToken);
  const tokenAndAdminHeaders: Record<string, string> = {};
  if (auth.token) tokenAndAdminHeaders.token = auth.token;
  if (auth.adminToken) tokenAndAdminHeaders.admintoken = auth.adminToken;

  attempts.push({
    strategy: "status_default_all_channels",
    endpoint: appendStatusParams(candidate, {
      token: auth.token,
      adminToken: auth.adminToken,
    }),
    headers: baseHeaders,
  });

  if (hasTokenPair) {
    for (const queryVariant of appendStatusParamsVariants(candidate, {
      token: auth.token,
      adminToken: auth.adminToken,
    })) {
      attempts.push({
        strategy: "status_query_only_variants",
        endpoint: queryVariant,
        headers: undefined,
      });
    }
    attempts.push({
      strategy: "status_token_admin_headers_only",
      endpoint: candidate,
      headers: Object.keys(tokenAndAdminHeaders).length > 0 ? tokenAndAdminHeaders : undefined,
    });
    attempts.push({
      strategy: "status_token_admin_headers_kebab",
      endpoint: candidate,
      headers: {
        ...(auth.token ? { "client-token": auth.token } : {}),
        ...(auth.adminToken ? { "admin-token": auth.adminToken } : {}),
      },
    });
    attempts.push({
      strategy: "status_token_admin_headers_pascal",
      endpoint: candidate,
      headers: {
        ...(auth.token ? { Token: auth.token } : {}),
        ...(auth.adminToken ? { AdminToken: auth.adminToken } : {}),
      },
    });
  }

  if (auth.apiKey) {
    attempts.push({
      strategy: "status_apikey_only",
      endpoint: candidate,
      headers: { apikey: auth.apiKey },
    });
    attempts.push({
      strategy: "status_x_api_key_only",
      endpoint: candidate,
      headers: { "x-api-key": auth.apiKey },
    });
  }

  if (auth.token) {
    attempts.push({
      strategy: "status_raw_token_query",
      endpoint: appendStatusParams(candidate, {
        token: auth.token,
        adminToken: auth.adminToken ?? auth.token,
      }),
      headers: undefined,
    });
    attempts.push({
      strategy: "status_raw_token_headers",
      endpoint: candidate,
      headers: {
        token: auth.token,
        admintoken: auth.adminToken ?? auth.token,
      },
    });
    attempts.push({
      strategy: "status_bearer_only",
      endpoint: candidate,
      headers: { Authorization: `Bearer ${auth.token}` },
    });
  }

  return attempts;
}

function truncateBody(value: string, limit = 180): string {
  return value.length <= limit ? value : `${value.slice(0, limit)}...`;
}

function buildHttpDetails(
  externalId: string,
  endpointChecked: string,
  statusCode: number,
  statusText: string,
  bodyPreview?: string
): ProviderStatusDetails {
  if (statusCode === 404) {
    return {
      externalId,
      endpointChecked,
      checkedAt: new Date().toISOString(),
      statusCode,
      statusText,
      errorType: "endpoint_not_found",
      bodyPreview,
      hint: "Endpoint de health não encontrado. Valide base URL e rotas disponíveis da UAZAPI.",
    };
  }
  if (statusCode === 401 || statusCode === 403) {
    return {
      externalId,
      endpointChecked,
      checkedAt: new Date().toISOString(),
      statusCode,
      statusText,
      errorType: "auth",
      bodyPreview,
      hint: "Falha de autenticação na UAZAPI. Verifique credencial da instância (apikey ou token/admintoken) e permissões.",
    };
  }
  if (statusCode >= 500) {
    return {
      externalId,
      endpointChecked,
      checkedAt: new Date().toISOString(),
      statusCode,
      statusText,
      errorType: "upstream_error",
      bodyPreview,
      hint: "Erro interno da UAZAPI. Verifique disponibilidade e logs do provedor.",
    };
  }
  return {
    externalId,
    endpointChecked,
    checkedAt: new Date().toISOString(),
    statusCode,
    statusText,
    errorType: "http_error",
    bodyPreview,
    hint: "Resposta HTTP inesperada no health check. Revise endpoint e configuração.",
  };
}

export async function fetchUazapiStatuses(): Promise<UazapiInstanceStatus[]> {
  const db = getDb();
  agentDebugLog({
    runId: "obs-uazapi-schema-check",
    hypothesisId: "H1",
    location: "src/server/integrations/uazapi/client.ts:fetchUazapiStatuses",
    message: "Starting UAZAPI status query with structured credentials columns",
    data: {
      databaseUrlHost: getDatabaseHostSafe(),
      nodeEnv: process.env.NODE_ENV ?? "undefined",
    },
  });

  let rows: Array<{
    id: string;
    tenantId: string;
    baseUrl: string;
    externalId: string;
    apiKeyEncrypted: string | null;
    tokenEncrypted: string | null;
    adminTokenEncrypted: string | null;
  }> = [];
  try {
    rows = await db
      .select({
        id: uazapiInstances.id,
        tenantId: uazapiInstances.tenantId,
        baseUrl: uazapiInstances.baseUrl,
        externalId: uazapiInstances.externalId,
        apiKeyEncrypted: uazapiInstances.apiKeyEncrypted,
        tokenEncrypted: uazapiInstances.tokenEncrypted,
        adminTokenEncrypted: uazapiInstances.adminTokenEncrypted,
      })
      .from(uazapiInstances);
  } catch (error) {
    const err = error as { code?: string; message?: string };
    agentDebugLog({
      runId: "obs-uazapi-schema-check",
      hypothesisId: "H2",
      location: "src/server/integrations/uazapi/client.ts:fetchUazapiStatuses.catch",
      message: "UAZAPI status query failed",
      data: {
        code: err?.code ?? "unknown",
        message: err?.message ?? String(error),
        databaseUrlHost: getDatabaseHostSafe(),
      },
    });
    if (!isMissingTokenEncryptedColumnError(error)) {
      throw error;
    }
    agentDebugLog({
      runId: "obs-uazapi-schema-check",
      hypothesisId: "H3",
      location: "src/server/integrations/uazapi/client.ts:fetchUazapiStatuses.fallback",
      message: "Falling back to legacy UAZAPI schema without token columns",
      data: {
        databaseUrlHost: getDatabaseHostSafe(),
      },
    });
    rows = await db
      .select({
        id: uazapiInstances.id,
        tenantId: uazapiInstances.tenantId,
        baseUrl: uazapiInstances.baseUrl,
        externalId: uazapiInstances.externalId,
        apiKeyEncrypted: uazapiInstances.apiKeyEncrypted,
      })
      .from(uazapiInstances)
      .then((legacyRows) =>
        legacyRows.map((row) => ({
          ...row,
          tokenEncrypted: null,
          adminTokenEncrypted: null,
        }))
      );
  }

  return Promise.all(
    rows.map(async (row) => {
      const start = Date.now();
      const candidates = buildHealthCandidates(row.baseUrl);
      let endpointChecked = candidates[0] ?? `${normalizeBaseUrl(row.baseUrl)}/health`;
      try {
        const auth = resolveRowCredential(row);

        let response: Response | null = null;
        for (const candidate of candidates) {
          const attempts = buildAuthAttempts(candidate, auth);
          for (const authAttempt of attempts) {
            endpointChecked = authAttempt.endpoint;
            const attempt = await requestWithTimeout(
              endpointChecked,
              row.baseUrl,
              {
                method: "GET",
                headers: authAttempt.headers,
              },
              7000
            );
            response = attempt;
            if (attempt.ok) {
              break;
            }
            if (attempt.status !== 401 && attempt.status !== 403) {
              break;
            }
          }
          if (!response) {
            continue;
          }
          if (response.ok || response.status !== 404) {
            break;
          }
        }
        if (!response) {
          throw new Error("No response from UAZAPI health candidates");
        }
        const latencyMs = Date.now() - start;

        if (response.ok) {
          return {
            instanceId: row.id,
            tenantId: row.tenantId,
            provider: "uazapi" as const,
            ok: true,
            status: "online",
            latencyMs,
            details: {
              externalId: row.externalId,
              endpointChecked: endpointForDetails(endpointChecked),
              checkedAt: new Date().toISOString(),
              statusCode: response.status,
              statusText: response.statusText,
            },
          };
        }

        const responseText = await response.text().catch(() => "");
        const details = buildHttpDetails(
          row.externalId,
          endpointForDetails(endpointChecked),
          response.status,
          response.statusText,
          responseText ? truncateBody(responseText) : undefined
        );
        console.warn("[observability:uazapi_http]", {
          instanceId: row.id,
          tenantId: row.tenantId,
          statusCode: response.status,
          statusText: response.statusText,
          endpointChecked: endpointForDetails(endpointChecked),
        });

        return {
          instanceId: row.id,
          tenantId: row.tenantId,
          provider: "uazapi" as const,
          ok: false,
          status: `http_${response.status}`,
          latencyMs,
          details,
        };
      } catch (err) {
        const latencyMs = Date.now() - start;
        const isTimeout =
          err instanceof DOMException
            ? err.name === "AbortError"
            : err instanceof Error && err.name === "AbortError";
        const errorMessage = err instanceof Error ? err.message : String(err);
        const details: ProviderStatusDetails = {
          externalId: row.externalId,
          endpointChecked: endpointForDetails(endpointChecked),
          checkedAt: new Date().toISOString(),
          errorType: isTimeout ? "timeout" : "network",
          error: errorMessage,
          hint: isTimeout
            ? "Timeout no health check. Verifique rede e disponibilidade da UAZAPI."
            : "Falha de rede ao consultar health check. Verifique URL, firewall e proxy.",
        };
        console.warn("[observability:uazapi_network]", {
          instanceId: row.id,
          tenantId: row.tenantId,
          endpointChecked: endpointForDetails(endpointChecked),
          error: errorMessage,
          timeout: isTimeout,
        });
        return {
          instanceId: row.id,
          tenantId: row.tenantId,
          provider: "uazapi" as const,
          ok: false,
          status: isTimeout ? "timeout" : "unreachable",
          latencyMs,
          details,
        };
      }
    })
  );
}
