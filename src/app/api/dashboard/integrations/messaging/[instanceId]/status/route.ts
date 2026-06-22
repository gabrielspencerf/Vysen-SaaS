import { NextResponse } from "next/server";
import { getEvolutionInstanceSecret } from "@/server/integrations/evolution/credentials";
import { fetchEvolutionConnectionState } from "@/server/integrations/evolution/reconnect";
import {
  fetchUazapiConnectionState,
  loadUazapiCredentialsForInstance,
} from "@/server/integrations/uazapi/reconnect";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { resolveMessagingInstanceForTenant } from "@/server/dashboard/messaging-instances";
import { messagingStatusUserMessage } from "@/server/dashboard/messaging-user-messages";
import { PERMISSION_SLUGS } from "@/server/rbac";

type RouteContext = { params: Promise<{ instanceId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { instanceId } = await context.params;

  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;

      const resolved = await resolveMessagingInstanceForTenant(tenantId, instanceId);
      if (!resolved) {
        return NextResponse.json({ error: "Instância não encontrada" }, { status: 404 });
      }

      if (resolved.provider === "evolution") {
        const apiKey = await getEvolutionInstanceSecret(resolved.id);
        const hasCredentials = Boolean(apiKey);
        const result = await fetchEvolutionConnectionState({
          baseUrl: resolved.baseUrl,
          externalId: resolved.externalId,
          apiKey,
        });
        if (!result.ok && result.error) {
          console.warn("[dashboard:messaging:status:evolution]", {
            instanceId: resolved.id,
            statusCode: result.statusCode,
          });
        }
        const userMessage = messagingStatusUserMessage({
          ok: result.ok,
          statusCode: result.statusCode,
          technicalError: result.error,
          provider: "evolution",
          hasCredentials,
        });
        return NextResponse.json({
          provider: "evolution" as const,
          ok: result.ok,
          state: result.state,
          ...(userMessage ? { userMessage } : {}),
        });
      }

      const creds = await loadUazapiCredentialsForInstance(resolved.id);
      const hasCredentials = Boolean(creds.apiKey || creds.token || creds.adminToken);
      const result = await fetchUazapiConnectionState({
        baseUrl: resolved.baseUrl,
        creds,
      });
      if (!result.ok && result.error) {
        console.warn("[dashboard:messaging:status:uazapi]", {
          instanceId: resolved.id,
          statusCode: result.statusCode,
        });
      }
      const userMessage = messagingStatusUserMessage({
        ok: result.ok,
        statusCode: result.statusCode,
        technicalError: result.error,
        provider: "uazapi",
        hasCredentials,
      });
      return NextResponse.json({
        provider: "uazapi" as const,
        ok: result.ok,
        state: result.state,
        ...(userMessage ? { userMessage } : {}),
      });
    }, PERMISSION_SLUGS.DASHBOARD_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
