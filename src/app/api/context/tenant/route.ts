/**
 * POST /api/context/tenant — troca o tenant atual da sessão.
 * Body: { tenant_id: string }
 * Valida membership; atualiza current_tenant_id na sessão (não cria nova sessão).
 */
import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  buildSetCookieHeader,
  buildSetCsrfCookieFromSession,
} from "@/server/auth";
import { PERMISSION_SLUGS, requirePermission } from "@/server/rbac";
import { switchTenant } from "@/server/tenancy/switch";

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAuth(request);
    if (session.session.currentTenantId) {
      await requirePermission(
        session.user.id,
        session.session.currentTenantId,
        PERMISSION_SLUGS.TENANT_SWITCH
      );
    }
  } catch (err) {
    const e = err as Error & { status?: number };
    const status = e.status ?? 401;
    return NextResponse.json(
      {
        error:
          status === 403
            ? "Sem permissão"
            : status === 400
              ? e.message || "Requisição inválida"
              : "Não autenticado",
      },
      { status }
    );
  }

  let body: { tenant_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo inválido" },
      { status: 400 }
    );
  }

  const tenantId = typeof body.tenant_id === "string" ? body.tenant_id.trim() : "";
  if (!tenantId) {
    return NextResponse.json(
      { error: "tenant_id é obrigatório" },
      { status: 400 }
    );
  }

  const result = await switchTenant(
    session.session.id,
    session.session.userId,
    tenantId
  );

  if (!result.ok) {
    if (result.error === "forbidden") {
      return NextResponse.json(
        { error: "Você não tem acesso a este tenant" },
        { status: 403 }
      );
    }
    if (result.error === "session_lost") {
      return NextResponse.json(
        { error: "Sessão inválida — entre novamente" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: "Não foi possível trocar o tenant" },
      { status: 400 }
    );
  }

  const response = NextResponse.json({ ok: true });
  if (result.token && result.maxAge) {
    response.headers.append(
      "Set-Cookie",
      buildSetCookieHeader(result.token, { maxAge: result.maxAge })
    );
    response.headers.append("Set-Cookie", buildSetCsrfCookieFromSession());
  }
  return response;
}
