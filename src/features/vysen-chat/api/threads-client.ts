/**
 * Cliente HTTP para sincronizar threads do Vysen com o servidor.
 * Envelope `{ ok, data }` esperado nas respostas de /api/dashboard/vysen/threads.
 */
import type { VysenChatThread } from "@/features/vysen-chat/model/types";

export interface VysenServerThread {
  id: string;
  title: string;
  contextArea: string;
  summary: string;
  contexts: string[];
  messages: { role: "user" | "assistant"; text: string }[];
  messageCount: number;
  experienceStarted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EnvelopeOk<T> {
  ok: true;
  data: T;
}
interface EnvelopeErr {
  ok: false;
  error: { code: string; message: string };
}

async function readEnvelope<T>(
  res: Response
): Promise<{ data?: T; error?: string }> {
  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  if (parsed && typeof parsed === "object" && "ok" in parsed) {
    const env = parsed as EnvelopeOk<T> | EnvelopeErr;
    if (env.ok) return { data: env.data };
    return { error: env.error?.message ?? "Erro desconhecido" };
  }
  if (!res.ok) return { error: "Falha na chamada" };
  return { data: parsed as T };
}

export async function fetchVysenThreadsServer(): Promise<VysenServerThread[]> {
  try {
    const res = await fetch("/api/dashboard/vysen/threads", { method: "GET" });
    const { data } = await readEnvelope<{ threads: VysenServerThread[] }>(res);
    return data?.threads ?? [];
  } catch {
    return [];
  }
}

export async function upsertVysenThreadServer(
  thread: VysenChatThread,
  experienceStarted: boolean
): Promise<VysenServerThread | null> {
  try {
    const res = await fetch(`/api/dashboard/vysen/threads/${thread.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: thread.title,
        contextArea: thread.contextArea,
        summary: thread.summary,
        contexts: thread.contexts,
        messages: thread.messages,
        experienceStarted,
      }),
    });
    const { data } = await readEnvelope<{ thread: VysenServerThread }>(res);
    return data?.thread ?? null;
  } catch {
    return null;
  }
}

export async function deleteVysenThreadServer(threadId: string): Promise<void> {
  try {
    await fetch(`/api/dashboard/vysen/threads/${threadId}`, { method: "DELETE" });
  } catch {
    // best-effort
  }
}
