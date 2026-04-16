import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin/require-admin";
import { askVysenCopilot } from "@/server/vysen/copilot";

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAdmin(request);
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json(
      { error: e.status === 403 ? "Sem permissão" : "Não autenticado" },
      { status: e.status ?? 401 }
    );
  }

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
  const tenantId = typeof body.tenantId === "string" ? body.tenantId : null;
  const reasoningMode =
    body.reasoningMode === "fast" || body.reasoningMode === "thinking"
      ? body.reasoningMode
      : "thinking";
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
      channel: "admin",
      reasoningMode,
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

