import { NextRequest, NextResponse } from "next/server";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import {
  buildCapiEventFromLead,
  decryptMetaTokens,
  getMetaAdsAccountById,
  sendCapiEvents,
} from "@/server/integrations/meta-ads";
import { listLeadsForCapiSend } from "@/server/dashboard/meta-capi";

const MAX_LEADS = 100;

function readMetadataNumber(
  metadata: Record<string, unknown> | null,
  fallback: number,
  ...keys: string[]
): number {
  if (!metadata) return fallback;
  for (const key of keys) {
    const v = metadata[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v.replace(",", "."));
      if (Number.isFinite(n)) return n;
    }
  }
  return fallback;
}

export async function POST(request: NextRequest) {
  let body: { accountId?: string; leadIds?: string[]; currencyCode?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const accountId = body.accountId;
  const leadIds = Array.isArray(body.leadIds) ? body.leadIds : [];
  if (!accountId || leadIds.length === 0) {
    return NextResponse.json(
      { error: "accountId e leadIds (não vazio) são obrigatórios" },
      { status: 400 }
    );
  }
  if (leadIds.length > MAX_LEADS) {
    return NextResponse.json(
      { error: `Máximo de ${MAX_LEADS} leads por envio` },
      { status: 400 }
    );
  }

  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;

      const account = await getMetaAdsAccountById(accountId!);
      if (!account || account.tenantId !== tenantId) {
        return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
      }
      if (!account.pixelId?.trim()) {
        return NextResponse.json(
          { error: "Configure o Pixel ID na conta Meta antes de enviar eventos CAPI" },
          { status: 400 }
        );
      }

      let accessToken: string;
      try {
        accessToken = decryptMetaTokens(account.longLivedTokenEncrypted);
      } catch {
        return NextResponse.json({ error: "Falha ao ler token da conta" }, { status: 500 });
      }

      const currency = body.currencyCode?.trim() || "BRL";
      const leads = await listLeadsForCapiSend(tenantId, leadIds);
      if (leads.length !== leadIds.length) {
        return NextResponse.json(
          { error: "Um ou mais leads não foram encontrados ou não estão qualificados/convertidos" },
          { status: 400 }
        );
      }

      const events = leads.map((lead) => {
        const metadata = (lead.metadata ?? null) as Record<string, unknown> | null;
        const status = lead.status === "converted" ? "converted" : "qualified";
        const value = readMetadataNumber(metadata, 0, "conversionValue", "leadValue", "value");
        return buildCapiEventFromLead({
          id: lead.id,
          status,
          email: lead.email,
          phone: lead.phone,
          lastSeenAt: lead.lastSeenAt,
          metadata,
          currency,
          value: value > 0 ? value : undefined,
        });
      });

      const result = await sendCapiEvents(account.pixelId.trim(), accessToken, events);
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 502 });
      }

      return NextResponse.json({
        ok: true,
        eventsReceived: result.eventsReceived ?? events.length,
        sent: events.length,
      });
    }, PERMISSION_SLUGS.LEADS_WRITE);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
