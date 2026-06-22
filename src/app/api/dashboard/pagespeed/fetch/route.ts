/**
 * POST /api/dashboard/pagespeed/fetch — dispara análise PageSpeed da URL configurada e grava resultado (mobile + desktop).
 * Requer PAGESPEED_API_KEY no .env.
 */
import { NextRequest, NextResponse } from "next/server";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import {
  getLandingPageUrlForTenant,
  savePageSpeedResult,
} from "@/server/dashboard";

const API_KEY = process.env.PAGESPEED_API_KEY;
const BASE = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

async function runPageSpeed(url: string, strategy: "mobile" | "desktop"): Promise<Record<string, unknown>> {
  const params = new URLSearchParams({
    url,
    strategy,
    key: API_KEY ?? "",
  });
  const res = await fetch(`${BASE}?${params}`);
  if (!res.ok) throw new Error(`PageSpeed API: ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json(
      { error: "PageSpeed API não configurada (PAGESPEED_API_KEY)." },
      { status: 503 }
    );
  }

  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;

      const landingUrl = await getLandingPageUrlForTenant(tenantId);
      if (!landingUrl) {
        return NextResponse.json(
          { error: "Configure a URL da landing na area Google Ads (secao PageSpeed)." },
          { status: 400 }
        );
      }

      try {
        const [mobileResult, desktopResult] = await Promise.all([
          runPageSpeed(landingUrl, "mobile"),
          runPageSpeed(landingUrl, "desktop"),
        ]);
        await savePageSpeedResult(tenantId, landingUrl, "mobile", mobileResult);
        await savePageSpeedResult(tenantId, landingUrl, "desktop", desktopResult);
        return NextResponse.json({ ok: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao chamar PageSpeed";
        return NextResponse.json({ error: msg }, { status: 502 });
      }
    }, PERMISSION_SLUGS.LEADS_WRITE);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
