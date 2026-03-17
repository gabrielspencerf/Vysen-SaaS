/**
 * Processador: raw event Evolution → conversations / conversation_messages.
 * Carrega raw event por id; atualiza processed_at (ou processing_error em falha).
 * Idempotente: upsert conversation por (tenant_id, evolution_instance_id, external_id);
 * mensagens dedup por (conversation_id, external_id).
 * Mensagens de áudio são transcritas via OpenAI Whisper e imagens descritas via Vision (OPENAI_API_KEY).
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  evolutionWebhookEvents,
  conversations,
  conversationMessages,
  evolutionInstances,
} from "@/db/schema";
import type { JobProcessEvolutionRaw } from "../queue/types";
import { getEvolutionInstanceSecret } from "@/server/integrations/evolution/credentials";
import { fetchEvolutionMediaAsBuffer } from "@/server/integrations/evolution/fetch-media";
import { transcribe } from "@/server/integrations/openai/transcribe";
import { describeImage } from "@/server/integrations/openai/describe-image";

const CONVERSATION_STATUS_OPEN = "open";

/** Event types que geram conversa/mensagem. eventType é normalizado: minúsculas, _ → . */
const SUPPORTED_MESSAGE_EVENTS = new Set([
  "messages.upsert",
  "send.message",
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

export type ParsedMessageContentType = "text" | "audio" | "image";

/**
 * Extrai dados da mensagem do payload Evolution (evento messages.upsert / send.message).
 * Detecta texto (conversation, extendedTextMessage), áudio (audioMessage) e imagem (imageMessage).
 */
function parseMessagesUpsert(
  payload: Record<string, unknown>
): {
  remoteJid: string;
  fromMe: boolean;
  messageId: string;
  contentType: ParsedMessageContentType;
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
  const messageId =
    stringOrNull(key.id) ?? stringOrNull(key.messageId);
  if (!remoteJid || !messageId) return null;

  const fromMe = key.fromMe === true;

  const message = data.message;
  let contentType: ParsedMessageContentType = "text";
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

export async function processEvolutionRaw(
  job: JobProcessEvolutionRaw
): Promise<{ ok: true } | { error: string }> {
  const db = getDb();
  const { rawEventId, tenantId, evolutionInstanceId } = job;

  try {
    return await processEvolutionRawInner(db, job);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(evolutionWebhookEvents)
      .set({
        processingError: msg.slice(0, 1024),
        processedAt: new Date(),
      })
      .where(eq(evolutionWebhookEvents.id, rawEventId));
    return { error: msg };
  }
}

async function processEvolutionRawInner(
  db: ReturnType<typeof getDb>,
  job: JobProcessEvolutionRaw
): Promise<{ ok: true } | { error: string }> {
  const { rawEventId, tenantId, evolutionInstanceId } = job;

  const [raw] = await db
    .select()
    .from(evolutionWebhookEvents)
    .where(eq(evolutionWebhookEvents.id, rawEventId))
    .limit(1);

  if (!raw) {
    return { error: `Raw event not found: ${rawEventId}` };
  }
  if (raw.processedAt) {
    return { ok: true };
  }

  const eventType = raw.eventType;
  const payload = raw.payload as Record<string, unknown>;
  const normalizedEvent = (eventType ?? "")
    .toLowerCase()
    .replace(/_/g, ".");

  if (!SUPPORTED_MESSAGE_EVENTS.has(normalizedEvent)) {
    await db
      .update(evolutionWebhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(evolutionWebhookEvents.id, rawEventId));
    return { ok: true };
  }

  const parsed = parseMessagesUpsert(payload);
  if (!parsed) {
    await db
      .update(evolutionWebhookEvents)
      .set({
        processingError: "Invalid messages.upsert payload (missing key/remoteJid/id)",
        processedAt: new Date(),
      })
      .where(eq(evolutionWebhookEvents.id, rawEventId));
    return { error: "Invalid messages.upsert payload" };
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
        eq(conversations.evolutionInstanceId, evolutionInstanceId),
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
        evolutionInstanceId,
        externalId: remoteJid,
        status: CONVERSATION_STATUS_OPEN,
        startedAt: sentAt,
        lastSyncedAt: now,
      })
      .returning({ id: conversations.id });
    if (!inserted) {
      await db
        .update(evolutionWebhookEvents)
        .set({
          processingError: "Failed to create conversation",
          processedAt: new Date(),
        })
        .where(eq(evolutionWebhookEvents.id, rawEventId));
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
    const [insertedMsg] = await db
      .insert(conversationMessages)
      .values({
        tenantId,
        conversationId,
        externalId: messageId,
        direction: fromMe ? "out" : "in",
        contentType,
        contentText: contentText,
        payload: payload,
        sentAt,
      })
      .returning({ id: conversationMessages.id });

    if (insertedMsg && contentType === "audio") {
      const transcript = await tryTranscribeAudio(db, evolutionInstanceId, messageId);
      if (transcript) {
        await db
          .update(conversationMessages)
          .set({
            contentText: contentText?.trim()
              ? `${contentText.trim()}\n\n— Transcrição: ${transcript}`
              : transcript,
          })
          .where(eq(conversationMessages.id, insertedMsg.id));
      }
    }
    if (insertedMsg && contentType === "image") {
      const description = await tryDescribeImage(db, evolutionInstanceId, messageId);
      if (description) {
        await db
          .update(conversationMessages)
          .set({
            contentText: contentText?.trim()
              ? `${contentText.trim()}\n\n— Descrição: ${description}`
              : description,
          })
          .where(eq(conversationMessages.id, insertedMsg.id));
      }
    }
  }

  await db
    .update(evolutionWebhookEvents)
    .set({ processedAt: new Date() })
    .where(eq(evolutionWebhookEvents.id, rawEventId));

  return { ok: true };
}

/**
 * Busca o áudio na Evolution, transcreve via Whisper e retorna o texto (ou null).
 */
async function tryTranscribeAudio(
  db: ReturnType<typeof getDb>,
  evolutionInstanceId: string,
  messageId: string
): Promise<string | null> {
  const media = await fetchEvolutionMediaForInstance(db, evolutionInstanceId, messageId);
  if (!media) return null;
  return transcribe(media.buffer, media.mimeType) ?? null;
}

/**
 * Busca a imagem na Evolution, descreve via OpenAI Vision e retorna o texto (ou null).
 */
async function tryDescribeImage(
  db: ReturnType<typeof getDb>,
  evolutionInstanceId: string,
  messageId: string
): Promise<string | null> {
  const media = await fetchEvolutionMediaForInstance(db, evolutionInstanceId, messageId);
  if (!media) return null;
  return describeImage(media.buffer, media.mimeType) ?? null;
}

async function fetchEvolutionMediaForInstance(
  db: ReturnType<typeof getDb>,
  evolutionInstanceId: string,
  messageId: string
): Promise<{ buffer: Buffer; mimeType?: string } | null> {
  const [instance] = await db
    .select({
      baseUrl: evolutionInstances.baseUrl,
      externalId: evolutionInstances.externalId,
    })
    .from(evolutionInstances)
    .where(eq(evolutionInstances.id, evolutionInstanceId))
    .limit(1);

  if (!instance) return null;

  const apiKey = await getEvolutionInstanceSecret(evolutionInstanceId);
  return fetchEvolutionMediaAsBuffer({
    baseUrl: instance.baseUrl,
    instanceName: instance.externalId,
    apiKey,
    messageId,
  });
}
