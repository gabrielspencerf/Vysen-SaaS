/**
 * GET  /api/dashboard/vysen/threads — lista threads do usuário+tenant.
 * POST /api/dashboard/vysen/threads — cria thread (upsert se id no body).
 */
import { NextRequest } from "next/server";
import { requireDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import { apiError, apiOk } from "@/server/http/api-contract";
import {
  listVysenThreadsForUser,
  upsertVysenThread,
} from "@/server/dashboard/vysen-threads";

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireDashboardApiAuth(request, PERMISSION_SLUGS.DASHBOARD_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
  const tenantId = session.session.currentTenantId!;
  const threads = await listVysenThreadsForUser({
    tenantId,
    userId: session.user.id,
    limit: 100,
  });
  return apiOk({ threads });
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireDashboardApiAuth(request, PERMISSION_SLUGS.DASHBOARD_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
  const tenantId = session.session.currentTenantId!;

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
  const threadId = typeof body.id === "string" ? body.id : undefined;

  const thread = await upsertVysenThread({
    tenantId,
    userId: session.user.id,
    threadId,
    title,
    contextArea,
    summary,
    contexts: contexts as string[],
    messages: messages as { role: "user" | "assistant"; text: string }[],
    experienceStarted,
  });

  return apiOk({ thread }, { status: threadId ? 200 : 201 });
}
