import { NextRequest, NextResponse } from "next/server";
import { requireDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import { askVysenCopilot } from "@/server/vysen/copilot";

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
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question : "";
  if (!question.trim()) {
    return NextResponse.json({ error: "Pergunta é obrigatória." }, { status: 400 });
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

  try {
    const result = await askVysenCopilot({
      question,
      tenantId,
      userId: session.user.id,
      channel: "dashboard",
      reasoningMode,
      contextArea,
      history,
      memoryContext: {
        threadSummary,
        threadContexts,
        previousSummaries,
      },
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Falha ao consultar a Vysen neste momento." },
      { status: 500 }
    );
  }
}

