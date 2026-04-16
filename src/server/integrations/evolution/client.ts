import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { evolutionInstances } from "@/db/schema";
import { getEvolutionInstanceSecret } from "./credentials";
import type { ProviderStatusDetails } from "@/server/integrations/providers/types";

export interface ProviderInstanceStatus {
  instanceId: string;
  tenantId: string;
  provider: "evolution";
  ok: boolean;
  status: string;
  latencyMs: number;
  details?: ProviderStatusDetails;
}

async function requestWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
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
      hint: "Endpoint de health não encontrado. Verifique base URL, path e versão da Evolution.",
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
      hint: "Falha de autenticação. Valide API key e permissões da instância.",
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
      hint: "Erro interno no provedor. Verifique logs da Evolution e disponibilidade.",
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

export async function fetchEvolutionStatuses(): Promise<ProviderInstanceStatus[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: evolutionInstances.id,
      tenantId: evolutionInstances.tenantId,
      baseUrl: evolutionInstances.baseUrl,
      externalId: evolutionInstances.externalId,
    })
    .from(evolutionInstances);

  return Promise.all(
    rows.map(async (row) => {
      const start = Date.now();
      const base = normalizeBaseUrl(row.baseUrl);
      const primaryEndpoint = `${base}/health`;
      const fallbackEndpoint = `${base}/`;
      let endpointChecked = primaryEndpoint;
      try {
        const secret = await getEvolutionInstanceSecret(row.id);
        let response = await requestWithTimeout(
          primaryEndpoint,
          {
            method: "GET",
            headers: secret ? { apikey: secret } : undefined,
          },
          7000
        );
        if (response.status === 404) {
          endpointChecked = fallbackEndpoint;
          response = await requestWithTimeout(
            fallbackEndpoint,
            {
              method: "GET",
              headers: secret ? { apikey: secret } : undefined,
            },
            7000
          );
        }
        const latencyMs = Date.now() - start;

        if (response.ok) {
          return {
            instanceId: row.id,
            tenantId: row.tenantId,
            provider: "evolution" as const,
            ok: true,
            status: "online",
            latencyMs,
            details: {
              externalId: row.externalId,
              endpointChecked,
              checkedAt: new Date().toISOString(),
              statusCode: response.status,
              statusText: response.statusText,
            },
          };
        }

        const responseText = await response.text().catch(() => "");
        const details = buildHttpDetails(
          row.externalId,
          endpointChecked,
          response.status,
          response.statusText,
          responseText ? truncateBody(responseText) : undefined
        );
        console.warn("[observability:evolution_http]", {
          instanceId: row.id,
          tenantId: row.tenantId,
          statusCode: response.status,
          statusText: response.statusText,
          endpointChecked,
        });

        return {
          instanceId: row.id,
          tenantId: row.tenantId,
          provider: "evolution" as const,
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
          endpointChecked,
          checkedAt: new Date().toISOString(),
          errorType: isTimeout ? "timeout" : "network",
          error: errorMessage,
          hint: isTimeout
            ? "Timeout no health check. Verifique rede, DNS e disponibilidade da instancia."
            : "Falha de rede ao consultar health check. Verifique URL, firewall e proxy.",
        };
        console.warn("[observability:evolution_network]", {
          instanceId: row.id,
          tenantId: row.tenantId,
          endpointChecked,
          error: errorMessage,
          timeout: isTimeout,
        });
        return {
          instanceId: row.id,
          tenantId: row.tenantId,
          provider: "evolution" as const,
          ok: false,
          status: isTimeout ? "timeout" : "unreachable",
          latencyMs,
          details,
        };
      }
    })
  );
}
