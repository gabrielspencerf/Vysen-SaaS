/**
 * GET    /api/dashboard/vysen/threads/[id] — detalhe da thread.
 * PUT    /api/dashboard/vysen/threads/[id] — substitui estado da thread.
 * DELETE /api/dashboard/vysen/threads/[id] — remove thread.
 */
import { NextRequest } from "next/server";
import { requireDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import { apiError, apiOk } from "@/server/http/api-contract";
import {
  deleteVysenThread,
  getVysenThreadForUser,
  upsertVysenThread,
} from "@/server/dashboard/vysen-threads";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireDashboardApiAuth(request, PERMISSION_SLUGS.DASHBOARD_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
  const tenantId = session.session.currentTenantId!;
  const { id } = await params;
  if (!id) {
    return apiError("resource_required", "ID obrigatório", { status: 400 });
  }
  const thread = await getVysenThreadForUser({
    tenantId,
    userId: session.user.id,
    threadId: id,
  });
  if (!thread) {
    return apiError("not_found", "Thread não encontrada", { status: 404 });
  }
  return apiOk({ thread });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireDashboardApiAuth(request, PERMISSION_SLUGS.DASHBOARD_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
  const tenantId = session.session.currentTenantId!;
  const { id } = await params;
  if (!id) {
    return apiError("resource_required", "ID obrigatório", { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_body", "Corpo inválido", { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title : "Nova conversa";
  const contextArea =
    typeof body.contextArea === "string" ? body.contextArea : "geral";
  const summary = typeof body.summary === "string" ? body.summary : undefined;
  const contexts = Array.isArray(body.contexts) ? (body.contexts as unknown[]) : [];
  const messages = Array.isArray(body.messages) ? (body.messages as unknown[]) : [];
  const experienceStarted = body.experienceStarted === true;

  const thread = await upsertVysenThread({
    tenantId,
    userId: session.user.id,
    threadId: id,
    title,
    contextArea,
    summary,
    contexts: contexts as string[],
    messages: messages as { role: "user" | "assistant"; text: string }[],
    experienceStarted,
  });

  return apiOk({ thread });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireDashboardApiAuth(request, PERMISSION_SLUGS.DASHBOARD_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
  const tenantId = session.session.currentTenantId!;
  const { id } = await params;
  if (!id) {
    return apiError("resource_required", "ID obrigatório", { status: 400 });
  }
  const result = await deleteVysenThread({
    tenantId,
    userId: session.user.id,
    threadId: id,
  });
  if ("error" in result) {
    return apiError("not_found", "Thread não encontrada", { status: 404 });
  }
  return apiOk({ ok: true });
}
