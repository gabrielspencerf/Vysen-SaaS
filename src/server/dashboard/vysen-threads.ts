/**
 * Persistência server-side das threads do copilot Vysen.
 * Owner = (tenant_id, user_id). Mensagens são guardadas no JSONB da thread
 * — formato espelha o tipo `VysenChatThread` do client.
 */
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { vysenChatThreads } from "@/db/schema";

type VysenChatRole = "user" | "assistant";

export interface VysenChatMessageRecord {
  role: VysenChatRole;
  text: string;
}

export interface VysenChatThreadRecord {
  id: string;
  title: string;
  contextArea: string;
  summary: string;
  contexts: string[];
  messages: VysenChatMessageRecord[];
  messageCount: number;
  experienceStarted: boolean;
  createdAt: string;
  updatedAt: string;
}

function normalizeMessages(value: unknown): VysenChatMessageRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (m): m is { role: VysenChatRole; text: string } =>
        Boolean(
          m &&
            typeof m === "object" &&
            ((m as { role?: unknown }).role === "user" ||
              (m as { role?: unknown }).role === "assistant") &&
            typeof (m as { text?: unknown }).text === "string"
        )
    )
    .map((m) => ({ role: m.role, text: String(m.text).slice(0, 8000) }));
}

function normalizeContexts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
    .map((c) => c.trim().slice(0, 1024))
    .slice(0, 24);
}

function toRecord(row: typeof vysenChatThreads.$inferSelect): VysenChatThreadRecord {
  return {
    id: row.id,
    title: row.title,
    contextArea: row.contextArea,
    summary: row.summary,
    contexts: normalizeContexts(row.contexts),
    messages: normalizeMessages(row.messages),
    messageCount: row.messageCount,
    experienceStarted: row.experienceStarted,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listVysenThreadsForUser(input: {
  tenantId: string;
  userId: string;
  limit?: number;
}): Promise<VysenChatThreadRecord[]> {
  const db = getDb();
  const limit = Math.max(1, Math.min(input.limit ?? 50, 200));
  const rows = await db
    .select()
    .from(vysenChatThreads)
    .where(
      and(
        eq(vysenChatThreads.tenantId, input.tenantId),
        eq(vysenChatThreads.userId, input.userId)
      )
    )
    .orderBy(desc(vysenChatThreads.updatedAt))
    .limit(limit);
  return rows.map(toRecord);
}

export async function getVysenThreadForUser(input: {
  tenantId: string;
  userId: string;
  threadId: string;
}): Promise<VysenChatThreadRecord | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(vysenChatThreads)
    .where(
      and(
        eq(vysenChatThreads.id, input.threadId),
        eq(vysenChatThreads.tenantId, input.tenantId),
        eq(vysenChatThreads.userId, input.userId)
      )
    )
    .limit(1);
  if (!row) return null;
  return toRecord(row);
}

export interface UpsertVysenThreadInput {
  tenantId: string;
  userId: string;
  threadId?: string;
  title: string;
  contextArea: string;
  summary?: string;
  contexts?: string[];
  messages: VysenChatMessageRecord[];
  experienceStarted?: boolean;
}

export async function upsertVysenThread(
  input: UpsertVysenThreadInput
): Promise<VysenChatThreadRecord> {
  const db = getDb();
  const normalizedMessages = normalizeMessages(input.messages);
  const normalizedContexts = normalizeContexts(input.contexts ?? []);
  const values = {
    title: input.title.trim().slice(0, 255) || "Nova conversa",
    contextArea: (input.contextArea || "geral").trim().slice(0, 64),
    summary: (input.summary ?? "").trim().slice(0, 512),
    contexts: normalizedContexts,
    messages: normalizedMessages,
    messageCount: normalizedMessages.length,
    experienceStarted: input.experienceStarted ?? false,
  };

  if (input.threadId) {
    const [updated] = await db
      .update(vysenChatThreads)
      .set(values)
      .where(
        and(
          eq(vysenChatThreads.id, input.threadId),
          eq(vysenChatThreads.tenantId, input.tenantId),
          eq(vysenChatThreads.userId, input.userId)
        )
      )
      .returning();
    if (updated) return toRecord(updated);
  }

  const [inserted] = await db
    .insert(vysenChatThreads)
    .values({
      ...(input.threadId ? { id: input.threadId } : {}),
      tenantId: input.tenantId,
      userId: input.userId,
      ...values,
    })
    .returning();
  return toRecord(inserted);
}

export async function deleteVysenThread(input: {
  tenantId: string;
  userId: string;
  threadId: string;
}): Promise<{ ok: true } | { error: "not_found" }> {
  const db = getDb();
  const result = await db
    .delete(vysenChatThreads)
    .where(
      and(
        eq(vysenChatThreads.id, input.threadId),
        eq(vysenChatThreads.tenantId, input.tenantId),
        eq(vysenChatThreads.userId, input.userId)
      )
    )
    .returning({ id: vysenChatThreads.id });
  if (result.length === 0) return { error: "not_found" };
  return { ok: true };
}
