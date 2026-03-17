/**
 * Processador: raw event UAZAPI → conversations / conversation_messages.
 * Paridade com Evolution: mesmo fluxo (eventos de mensagem → conversa + mensagem).
 * Payload esperado no formato compatível com Evolution (event, data.key, data.message).
 * Áudio/imagem: por enquanto só persiste legenda; transcrição/descrição pode ser adicionada quando houver API de mídia UAZAPI.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  uazapiWebhookEvents,
  conversations,
  conversationMessages,
} from "@/db/schema";
import type { JobProcessUazapiRaw } from "../queue/types";

const CONVERSATION_STATUS_OPEN = "open";

const SUPPORTED_MESSAGE_EVENTS = new Set([
  "messages.upsert",
  "messages_upsert",
  "send.message",
  "send_message",
]);

function stringOrNull(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function numberOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

type ContentType = "text" | "audio" | "image";

function parseMessagePayload(payload: Record<string, unknown>): {
  remoteJid: string;
  fromMe: boolean;
  messageId: string;
  contentType: ContentType;
  contentText: string | null;
  messageTimestamp: number;
} | null {
  const data = (payload.data ?? payload) as Record<string, unknown>;
  if (!data || typeof data !== "object") return null;

  const key = data.key as Record<string, unknown> | undefined;
  if (!key || typeof key !== "object") return null;

  const remoteJid =
    stringOrNull(key.remoteJid) ??
    stringOrNull(payload.remoteJid) ??
    stringOrNull(data.remoteJid);
  const messageId = stringOrNull(key.id) ?? stringOrNull(key.messageId);
  if (!remoteJid || !messageId) return null;

  const fromMe = key.fromMe === true;

  const message = data.message;
  let contentType: ContentType = "text";
  let contentText: string | null = null;

  if (typeof message === "string" && message.trim()) {
    contentText = message.trim();
  } else if (message && typeof message === "object") {
    const msg = message as Record<string, unknown>;
    if (msg.audioMessage && typeof msg.audioMessage === "object") {
      contentType = "audio";
      const audio = msg.audioMessage as Record<string, unknown>;
      contentText = stringOrNull(audio.caption) ?? null;
    } else if (msg.imageMessage && typeof msg.imageMessage === "object") {
      contentType = "image";
      const img = msg.imageMessage as Record<string, unknown>;
      contentText = stringOrNull(img.caption) ?? null;
    } else {
      contentText =
        stringOrNull(msg.conversation) ??
        (msg.extendedTextMessage && typeof msg.extendedTextMessage === "object"
          ? stringOrNull((msg.extendedTextMessage as Record<string, unknown>).text)
          : null) ??
        stringOrNull(msg.text);
    }
  }

  const ts =
    numberOrNull(data.messageTimestamp) ??
    numberOrNull(payload.messageTimestamp) ??
    numberOrNull(data.messageTimestamp);
  const messageTimestamp = ts ?? Math.floor(Date.now() / 1000);

  return { remoteJid, fromMe, messageId, contentType, contentText, messageTimestamp };
}

export async function processUazapiRaw(
  job: JobProcessUazapiRaw
): Promise<{ ok: true } | { error: string }> {
  const db = getDb();
  const { rawEventId, tenantId, uazapiInstanceId } = job;

  try {
    return await processUazapiRawInner(db, job);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(uazapiWebhookEvents)
      .set({
        processingError: msg.slice(0, 1024),
        processedAt: new Date(),
      })
      .where(eq(uazapiWebhookEvents.id, rawEventId));
    return { error: msg };
  }
}

async function processUazapiRawInner(
  db: ReturnType<typeof getDb>,
  job: JobProcessUazapiRaw
): Promise<{ ok: true } | { error: string }> {
  const { rawEventId, tenantId, uazapiInstanceId } = job;

  const [raw] = await db
    .select()
    .from(uazapiWebhookEvents)
    .where(eq(uazapiWebhookEvents.id, rawEventId))
    .limit(1);

  if (!raw) {
    return { error: `Raw event not found: ${rawEventId}` };
  }
  if (raw.processedAt) {
    return { ok: true };
  }

  const eventType = raw.eventType;
  const payload = raw.payload as Record<string, unknown>;
  const normalizedEvent = (eventType ?? "").toLowerCase().replace(/_/g, ".");

  if (!SUPPORTED_MESSAGE_EVENTS.has(normalizedEvent)) {
    await db
      .update(uazapiWebhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(uazapiWebhookEvents.id, rawEventId));
    return { ok: true };
  }

  const parsed = parseMessagePayload(payload);
  if (!parsed) {
    await db
      .update(uazapiWebhookEvents)
      .set({
        processingError: "Invalid message payload (missing key/remoteJid/id)",
        processedAt: new Date(),
      })
      .where(eq(uazapiWebhookEvents.id, rawEventId));
    return { error: "Invalid message payload" };
  }

  const { remoteJid, fromMe, messageId, contentType, contentText, messageTimestamp } = parsed;
  const sentAt = new Date(messageTimestamp * 1000);
  const now = new Date();

  const [existingConv] = await db
    .select({ id: conversations.id, startedAt: conversations.startedAt })
    .from(conversations)
    .where(
      and(
        eq(conversations.tenantId, tenantId),
        eq(conversations.uazapiInstanceId, uazapiInstanceId),
        eq(conversations.externalId, remoteJid)
      )
    )
    .limit(1);

  let conversationId: string;
  if (existingConv) {
    conversationId = existingConv.id;
    await db
      .update(conversations)
      .set({ lastSyncedAt: now, updatedAt: now })
      .where(eq(conversations.id, conversationId));
  } else {
    const [inserted] = await db
      .insert(conversations)
      .values({
        tenantId,
        uazapiInstanceId,
        externalId: remoteJid,
        status: CONVERSATION_STATUS_OPEN,
        startedAt: sentAt,
        lastSyncedAt: now,
      })
      .returning({ id: conversations.id });
    if (!inserted) {
      await db
        .update(uazapiWebhookEvents)
        .set({
          processingError: "Failed to create conversation",
          processedAt: new Date(),
        })
        .where(eq(uazapiWebhookEvents.id, rawEventId));
      return { error: "Failed to create conversation" };
    }
    conversationId = inserted.id;
  }

  const [existingMsg] = await db
    .select({ id: conversationMessages.id })
    .from(conversationMessages)
    .where(
      and(
        eq(conversationMessages.conversationId, conversationId),
        eq(conversationMessages.externalId, messageId)
      )
    )
    .limit(1);

  if (!existingMsg) {
    await db.insert(conversationMessages).values({
      tenantId,
      conversationId,
      externalId: messageId,
      direction: fromMe ? "out" : "in",
      contentType,
      contentText: contentText,
      payload: payload,
      sentAt,
    });
  }

  await db
    .update(uazapiWebhookEvents)
    .set({ processedAt: new Date() })
    .where(eq(uazapiWebhookEvents.id, rawEventId));

  return { ok: true };
}
