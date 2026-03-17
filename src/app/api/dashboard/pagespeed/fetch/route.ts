/**
 * POST /api/dashboard/pagespeed/fetch — dispara análise PageSpeed da URL configurada e grava resultado (mobile + desktop).
 * Requer PAGESPEED_API_KEY no .env.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
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
  let session;
  try {
    session = await requireAuth(request);
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json(
      { error: "Não autenticado" },
      { status: e.status ?? 401 }
    );
  }

  const tenantId = session.session.currentTenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant não selecionado" },
      { status: 400 }
    );
  }

  if (!API_KEY) {
    return NextResponse.json(
      { error: "PageSpeed API não configurada (PAGESPEED_API_KEY)." },
      { status: 503 }
    );
  }

  const landingUrl = await getLandingPageUrlForTenant(tenantId);
  if (!landingUrl) {
    return NextResponse.json(
      { error: "Configure a URL da landing na página PageSpeed." },
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
    return NextResponse.json(
      { error: msg },
      { status: 502 }
    );
  }
}
