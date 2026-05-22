import { NextRequest, NextResponse } from "next/server";
import { requireDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import { askVysenCopilot } from "@/server/vysen/copilot";
import { apiError, apiOk } from "@/server/http/api-contract";
import { emitDomainEvent } from "@/server/observability/domain-events";
import { checkRateLimit } from "@/server/security/rate-limit";
import { scrubSecretsForLlm } from "@/server/security/log-redact";

const QUESTION_MAX_CHARS = 4000;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX = 20;

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireDashboardApiAuth(request, PERMISSION_SLUGS.DASHBOARD_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }

  const tenantId = session.session.currentTenantId!;

  const rate = await checkRateLimit({
    request,
    bucket: "vysen-chat",
    max: RATE_LIMIT_MAX,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    resourceKey: `${tenantId}:${session.user.id}`,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "rate_limited",
        message: "Muitas perguntas em pouco tempo. Aguarde e tente novamente.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSeconds),
          "X-RateLimit-Remaining": String(rate.remaining),
        },
      }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_body", "Corpo inválido", { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question : "";
  if (!question.trim()) {
    return apiError("question_required", "Pergunta é obrigatória.", { status: 400 });
  }
  if (question.length > QUESTION_MAX_CHARS) {
    return apiError("question_too_long", `Pergunta excede ${QUESTION_MAX_CHARS} caracteres.`, {
      status: 413,
    });
  }
  const contextArea =
    typeof body.contextArea === "string" && body.contextArea.trim()
      ? body.contextArea.trim()
      : "geral";
  const reasoningMode =
    body.reasoningMode === "fast" || body.reasoningMode === "thinking"
      ? body.reasoningMode
      : "thinking";
  const history = Array.isArray(body.history)
    ? body.history
        .filter(
          (item): item is { role: "user" | "assistant"; content: string } =>
            Boolean(
              item &&
                typeof item === "object" &&
                (item as { role?: unknown }).role &&
                ((item as { role?: unknown }).role === "user" ||
                  (item as { role?: unknown }).role === "assistant") &&
                typeof (item as { content?: unknown }).content === "string"
            )
        )
        .slice(-12)
    : [];
  const memoryContext =
    body.memoryContext && typeof body.memoryContext === "object"
      ? (body.memoryContext as {
          threadSummary?: unknown;
          threadContexts?: unknown;
          previousSummaries?: unknown;
        })
      : null;
  const threadSummary =
    typeof memoryContext?.threadSummary === "string"
      ? memoryContext.threadSummary.trim().slice(0, 420)
      : null;
  const threadContexts = Array.isArray(memoryContext?.threadContexts)
    ? memoryContext.threadContexts
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim().slice(0, 380))
        .slice(0, 12)
    : [];
  const previousSummaries = Array.isArray(memoryContext?.previousSummaries)
    ? memoryContext.previousSummaries
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim().slice(0, 280))
        .slice(0, 8)
    : [];

  // Scrub de segredos antes de enviar ao modelo externo. Preserva email/telefone
  // (dados de trabalho legítimos da plataforma); remove tokens, JWTs, Bearer e
  // query-string secrets que podem ter sido coladas acidentalmente.
  const cleanQuestion = scrubSecretsForLlm(question);
  const cleanHistory = history.map((item) => ({
    role: item.role,
    content: scrubSecretsForLlm(item.content),
  }));
  const cleanThreadSummary = threadSummary ? scrubSecretsForLlm(threadSummary) : null;
  const cleanThreadContexts = threadContexts.map(scrubSecretsForLlm);
  const cleanPreviousSummaries = previousSummaries.map(scrubSecretsForLlm);

  try {
    const result = await askVysenCopilot({
      question: cleanQuestion,
      tenantId,
      userId: session.user.id,
      channel: "dashboard",
      reasoningMode,
      contextArea,
      history: cleanHistory,
      memoryContext: {
        threadSummary: cleanThreadSummary,
        threadContexts: cleanThreadContexts,
        previousSummaries: cleanPreviousSummaries,
      },
      // Cliente desconectou (fechou aba, navegou) → cancela OpenAI em curso.
      signal: request.signal,
    });
    emitDomainEvent({
      name: "vysen.chat.completed",
      tenantId,
      metadata: {
        contextArea,
        reasoningMode,
        historySize: history.length,
      },
    });
    return apiOk(result);
  } catch {
    emitDomainEvent({
      name: "vysen.chat.failed",
      level: "error",
      tenantId,
      metadata: { contextArea, reasoningMode },
    });
    return apiError("vysen_unavailable", "Falha ao consultar a Vysen neste momento.", {
      status: 500,
    });
  }
}

