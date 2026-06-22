import { NextRequest } from "next/server";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import { apiError, apiOk } from "@/server/http/api-contract";
import {
  listInternalNotificationsForUser,
  markInternalNotificationsAsRead,
} from "@/server/notifications/internal";

function pickPgCode(e: unknown): string | undefined {
  if (typeof e === "object" && e !== null && "code" in e) {
    const c = (e as { code: unknown }).code;
    if (typeof c === "string") return c;
    if (typeof c === "number" && Number.isFinite(c)) return String(c);
  }
  return undefined;
}

/** Postgres às vezes vem em `error.cause` (Drizzle/driver). */
function pickPgCodeDeep(e: unknown): string | undefined {
  let cur: unknown = e;
  const seen = new Set<unknown>();
  for (let i = 0; i < 6 && cur && typeof cur === "object"; i++) {
    if (seen.has(cur)) break;
    seen.add(cur);
    const code = pickPgCode(cur);
    if (code) return code;
    cur = "cause" in cur ? (cur as { cause: unknown }).cause : undefined;
  }
  return undefined;
}

/** Mensagem agregada da cadeia de erros (pt/en). */
function collectErrorMessages(e: unknown): string {
  const parts: string[] = [];
  let cur: unknown = e;
  const seen = new Set<unknown>();
  for (let i = 0; i < 6 && cur; i++) {
    if (typeof cur === "object" && cur !== null) {
      if (seen.has(cur)) break;
      seen.add(cur);
      const msg = (cur as Error).message;
      if (typeof msg === "string" && msg.trim()) parts.push(msg);
      cur = "cause" in cur ? (cur as { cause: unknown }).cause : undefined;
    } else break;
  }
  return parts.join(" | ");
}

const NOTIFICATIONS_SCHEMA_HINT =
  "Notificações indisponíveis: falta criar as tabelas no Postgres. Na raiz do projeto rode `npm run db:migrate` ou execute o arquivo `src/db/migrations/0013_agent_notifications_followups.sql` no banco configurado em DATABASE_URL.";

/** Tabela ausente (migration não aplicada) — Postgres `42P01`. */
function isMissingAgentNotificationsSchema(
  pgCode: string | undefined,
  message: string
): boolean {
  if (pgCode !== "42P01") return false;
  const m = message.toLowerCase();
  return (
    m.includes("internal_notifications") ||
    m.includes("followup_tasks") ||
    (m.includes("does not exist") &&
      (m.includes("internal_notification") || m.includes("followup_task"))) ||
    (m.includes("não existe") && m.includes("internal_notification"))
  );
}

export async function GET(request: NextRequest) {
  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;
      try {
        const notifications = await listInternalNotificationsForUser({
          tenantId,
          userId: session.user.id,
          limit: 100,
        });
        return apiOk({ notifications });
      } catch (e) {
        const pgCode = pickPgCodeDeep(e);
        const fullMessage = collectErrorMessages(e);
        if (isMissingAgentNotificationsSchema(pgCode, fullMessage)) {
          return apiError("schema_missing", NOTIFICATIONS_SCHEMA_HINT, { status: 503 });
        }
        return apiError("notifications_list_failed", "Erro interno ao listar notificações.", {
          status: 500,
        });
      }
    }, PERMISSION_SLUGS.DASHBOARD_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}

export async function PATCH(request: NextRequest) {
  let body: { ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_body", "Corpo inválido", { status: 400 });
  }

  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;

      const ids = Array.isArray(body.ids)
        ? body.ids.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];

      try {
        await markInternalNotificationsAsRead({
          tenantId,
          userId: session.user.id,
          ids,
        });
      } catch (e) {
        const pgCode = pickPgCodeDeep(e);
        const fullMessage = collectErrorMessages(e);
        if (isMissingAgentNotificationsSchema(pgCode, fullMessage)) {
          return apiError("schema_missing", NOTIFICATIONS_SCHEMA_HINT, { status: 503 });
        }
        return apiError("notifications_update_failed", "Erro interno ao atualizar notificações.", {
          status: 500,
        });
      }

      return apiOk({ acknowledged: true });
    }, PERMISSION_SLUGS.DASHBOARD_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
