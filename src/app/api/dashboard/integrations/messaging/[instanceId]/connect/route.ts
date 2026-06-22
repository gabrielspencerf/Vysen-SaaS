import { NextRequest, NextResponse } from "next/server";
import { getEvolutionInstanceSecret } from "@/server/integrations/evolution/credentials";
import { fetchEvolutionConnect } from "@/server/integrations/evolution/reconnect";
import {
  fetchUazapiConnect,
  loadUazapiCredentialsForInstance,
} from "@/server/integrations/uazapi/reconnect";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { resolveMessagingInstanceForTenant } from "@/server/dashboard/messaging-instances";
import { messagingConnectUserMessage } from "@/server/dashboard/messaging-user-messages";
import { checkRateLimit } from "@/server/security/rate-limit";
import { PERMISSION_SLUGS } from "@/server/rbac";

type RouteContext = { params: Promise<{ instanceId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { instanceId } = await context.params;

  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;
      const userId = session.user.id;

      const rl = await checkRateLimit({
        request,
        bucket: "dashboard_messaging_connect",
        max: 20,
        windowSeconds: 60,
        resourceKey: userId,
      });
      if (!rl.allowed) {
        return NextResponse.json(
          { userMessage: "Você fez muitas tentativas seguidas. Aguarde um minuto e tente de novo." },
          {
            status: 429,
            headers: { "Retry-After": String(rl.retryAfterSeconds) },
          }
        );
      }

      const resolved = await resolveMessagingInstanceForTenant(tenantId, instanceId);
      if (!resolved) {
        return NextResponse.json(
          { userMessage: "Esta instância não foi encontrada ou não pertence à sua conta." },
          { status: 404 }
        );
      }

      if (resolved.provider === "evolution") {
        const apiKey = await getEvolutionInstanceSecret(resolved.id);
        const hasCredentials = Boolean(apiKey);
        const result = await fetchEvolutionConnect({
          baseUrl: resolved.baseUrl,
          externalId: resolved.externalId,
          apiKey,
        });
        if (!result.ok) {
          if (result.error) {
            console.warn("[dashboard:messaging:connect:evolution]", {
              instanceId: resolved.id,
              statusCode: result.statusCode,
            });
          }
          const userMessage = messagingConnectUserMessage({
            ok: false,
            statusCode: result.statusCode,
            technicalError: result.error,
            provider: "evolution",
            hasCredentials,
          });
          return NextResponse.json({ userMessage }, { status: 502 });
        }
        return NextResponse.json({
          provider: "evolution" as const,
          qrDataUrl: result.payload?.qrDataUrl,
          pairingCode: result.payload?.pairingCode,
          code: result.payload?.code,
        });
      }

      const creds = await loadUazapiCredentialsForInstance(resolved.id);
      const hasCredentials = Boolean(creds.apiKey || creds.token || creds.adminToken);
      const result = await fetchUazapiConnect({
        baseUrl: resolved.baseUrl,
        creds,
      });
      if (!result.ok) {
        if (result.error) {
          console.warn("[dashboard:messaging:connect:uazapi]", {
            instanceId: resolved.id,
            statusCode: result.statusCode,
          });
        }
        const userMessage = messagingConnectUserMessage({
          ok: false,
          statusCode: result.statusCode,
          technicalError: result.error,
          provider: "uazapi",
          hasCredentials,
        });
        return NextResponse.json({ userMessage }, { status: 502 });
      }
      return NextResponse.json({
        provider: "uazapi" as const,
        qrDataUrl: result.payload?.qrDataUrl,
        pairingCode: result.payload?.pairingCode,
        code: result.payload?.code,
      });
    }, PERMISSION_SLUGS.DASHBOARD_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
