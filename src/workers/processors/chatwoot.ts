/**
 * Processador: raw event Chatwoot → conversations / conversation_messages.
 * Idempotente: conversa por (tenant_id, chatwoot_account_id, external_id = conversation.id Chatwoot);
 * mensagens por (conversation_id, external_id = message.id).
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  chatwootWebhookEvents,
  conversations,
  conversationMessages,
} from "@/db/schema";
import type { JobProcessChatwootRaw } from "../queue/types";
import { findOrCreateContactFromPhoneOrEmail } from "@/server/integrations/conversation-contact";
import { enqueueConversationClassification } from "@/server/ai/enqueue-classification";

const CONVERSATION_STATUS_OPEN = "open";

const SUPPORTED_EVENTS = new Set([
  "conversation_created",
  "conversation_updated",
  "message_created",
]);

function stringOrNull(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function parseChatwootDate(v: unknown): Date {
  if (typeof v === "string" && v.trim()) {
    const d = new Date(v.trim());
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    return new Date(v < 1e12 ? v * 1000 : v);
  }
  return new Date();
}

function getConversationObject(
  payload: Record<string, unknown>
): Record<string, unknown> | null {
  const c = payload.conversation;
  if (c && typeof c === "object") return c as Record<string, unknown>;
  return null;
}

/** Campos da mensagem podem vir no root (webhook clássico) ou em `message`. */
function getMessageSlice(payload: Record<string, unknown>): Record<string, unknown> {
  const m = payload.message;
  if (m && typeof m === "object") return m as Record<string, unknown>;
  return payload;
}

function inferDirection(messageType: unknown): "in" | "out" {
  if (messageType === "incoming" || messageType === 0) return "in";
  return "out";
}

function extractContactFromConversation(
  conv: Record<string, unknown>
): { phone: string | null; email: string | null; name: string | null } {
  let phone: string | null = null;
  let email: string | null = null;
  let name: string | null = null;

  const ci = conv.contact_inbox;
  if (ci && typeof ci === "object") {
    const contact = (ci as Record<string, unknown>).contact;
    if (contact && typeof contact === "object") {
      const c = contact as Record<string, unknown>;
      name = stringOrNull(c.name);
      phone =
        stringOrNull(c.phone_number as string) ??
        stringOrNull(c.phone as string);
      email = stringOrNull(c.email as string);
    }
  }

  const meta = conv.meta;
  if (meta && typeof meta === "object") {
    const sender = (meta as Record<string, unknown>).sender;
    if (sender && typeof sender === "object") {
      const s = sender as Record<string, unknown>;
      if (s.type === "contact") {
        name = name ?? stringOrNull(s.name as string);
        phone =
          phone ??
          stringOrNull(s.phone_number as string) ??
          stringOrNull(s.phone as string);
        email = email ?? stringOrNull(s.email as string);
      }
    }
  }

  return { phone, email, name };
}

function mapChatwootContent(msg: Record<string, unknown>): {
  contentType: "text" | "audio" | "image";
  contentText: string | null;
} {
  const attachments = Array.isArray(msg.attachments)
    ? (msg.attachments as Record<string, unknown>[])
    : [];
  for (const a of attachments) {
    const ft = stringOrNull(a.file_type as string)?.toLowerCase() ?? "";
    if (ft.includes("image"))
      return {
        contentType: "image",
        contentText: stringOrNull(msg.content as string),
      };
    if (ft.includes("audio"))
      return {
        contentType: "audio",
        contentText: stringOrNull(msg.content as string),
      };
  }

  const ct = stringOrNull(msg.content_type)?.toLowerCase() ?? "text";
  if (ct.includes("audio"))
    return { contentType: "audio", contentText: stringOrNull(msg.content as string) };
  if (ct.includes("image"))
    return { contentType: "image", contentText: stringOrNull(msg.content as string) };

  const text =
    typeof msg.content === "string"
      ? msg.content
      : typeof msg.processed_message_content === "string"
        ? (msg.processed_message_content as string)
        : null;
  return { contentType: "text", contentText: text?.trim() ? text : null };
}

async function upsertChatwootConversation(
  db: ReturnType<typeof getDb>,
  input: {
    tenantId: string;
    chatwootAccountId: string;
    conv: Record<string, unknown>;
    defaultStartedAt: Date;
  }
): Promise<{ conversationId: string } | { error: string }> {
  const extId = stringOrNull(String(input.conv.id ?? ""));
  if (!extId) return { error: "Missing conversation id" };

  const { phone, email, name } = extractContactFromConversation(input.conv);
  const contactId = await findOrCreateContactFromPhoneOrEmail({
    tenantId: input.tenantId,
    phone,
    email,
    name,
  });

  const rawStarted = input.conv.created_at ?? input.conv.timestamp;
  const startedAt =
    rawStarted !== undefined && rawStarted !== null
      ? parseChatwootDate(rawStarted)
      : input.defaultStartedAt;
  const now = new Date();

  const [existingConv] = await db
    .select({
      id: conversations.id,
      contactId: conversations.contactId,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.tenantId, input.tenantId),
        eq(conversations.chatwootAccountId, input.chatwootAccountId),
        eq(conversations.externalId, extId)
      )
    )
    .limit(1);

  if (existingConv) {
    await db
      .update(conversations)
      .set({
        lastSyncedAt: now,
        updatedAt: now,
        ...(contactId && !existingConv.contactId ? { contactId } : {}),
      })
      .where(eq(conversations.id, existingConv.id));
    return { conversationId: existingConv.id };
  }

  const [inserted] = await db
    .insert(conversations)
    .values({
      tenantId: input.tenantId,
      chatwootAccountId: input.chatwootAccountId,
      contactId,
      externalId: extId,
      status: CONVERSATION_STATUS_OPEN,
      startedAt,
      lastSyncedAt: now,
    })
    .returning({ id: conversations.id });

  if (!inserted) return { error: "Failed to create conversation" };
  return { conversationId: inserted.id };
}

export async function processChatwootRaw(
  job: JobProcessChatwootRaw
): Promise<{ ok: true } | { error: string }> {
  const db = getDb();
  const { rawEventId } = job;

  try {
    return await processChatwootRawInner(db, job);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(chatwootWebhookEvents)
      .set({
        processingError: msg.slice(0, 1024),
        processedAt: new Date(),
      })
      .where(eq(chatwootWebhookEvents.id, rawEventId));
    return { error: msg };
  }
}

async function processChatwootRawInner(
  db: ReturnType<typeof getDb>,
  job: JobProcessChatwootRaw
): Promise<{ ok: true } | { error: string }> {
  const { rawEventId, tenantId, chatwootAccountId } = job;

  const [raw] = await db
    .select()
    .from(chatwootWebhookEvents)
    .where(
      and(
        eq(chatwootWebhookEvents.id, rawEventId),
        eq(chatwootWebhookEvents.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!raw) return { error: `Raw event not found: ${rawEventId}` };
  if (raw.processedAt) return { ok: true };

  const eventType = raw.eventType;
  if (!SUPPORTED_EVENTS.has(eventType)) {
    await db
      .update(chatwootWebhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(chatwootWebhookEvents.id, rawEventId));
    return { ok: true };
  }

  const payload = raw.payload as Record<string, unknown>;
  const conv = getConversationObject(payload);

  if (eventType === "conversation_created" || eventType === "conversation_updated") {
    if (!conv) {
      await db
        .update(chatwootWebhookEvents)
        .set({
          processingError: "Missing conversation in payload",
          processedAt: new Date(),
        })
        .where(eq(chatwootWebhookEvents.id, rawEventId));
      return { error: "Missing conversation" };
    }
    const up = await upsertChatwootConversation(db, {
      tenantId,
      chatwootAccountId,
      conv,
      defaultStartedAt: raw.receivedAt ?? new Date(),
    });
    if ("error" in up) {
      await db
        .update(chatwootWebhookEvents)
        .set({
          processingError: up.error.slice(0, 1024),
          processedAt: new Date(),
        })
        .where(eq(chatwootWebhookEvents.id, rawEventId));
      return { error: up.error };
    }
    await db
      .update(chatwootWebhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(chatwootWebhookEvents.id, rawEventId));
    return { ok: true };
  }

  // message_created
  if (!conv) {
    await db
      .update(chatwootWebhookEvents)
      .set({
        processingError: "Missing conversation for message_created",
        processedAt: new Date(),
      })
      .where(eq(chatwootWebhookEvents.id, rawEventId));
    return { error: "Missing conversation" };
  }

  if (payload.private === true) {
    await db
      .update(chatwootWebhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(chatwootWebhookEvents.id, rawEventId));
    return { ok: true };
  }

  const msgSlice = getMessageSlice(payload);
  const messageId = stringOrNull(String(msgSlice.id ?? payload.id ?? ""));
  if (!messageId) {
    await db
      .update(chatwootWebhookEvents)
      .set({
        processingError: "Missing message id",
        processedAt: new Date(),
      })
      .where(eq(chatwootWebhookEvents.id, rawEventId));
    return { error: "Missing message id" };
  }

  const upConv = await upsertChatwootConversation(db, {
    tenantId,
    chatwootAccountId,
    conv,
    defaultStartedAt: raw.receivedAt ?? new Date(),
  });
  if ("error" in upConv) {
    await db
      .update(chatwootWebhookEvents)
      .set({
        processingError: upConv.error.slice(0, 1024),
        processedAt: new Date(),
      })
      .where(eq(chatwootWebhookEvents.id, rawEventId));
    return { error: upConv.error };
  }
  const conversationId = upConv.conversationId;

  const sender = payload.sender as Record<string, unknown> | undefined;
  const sentByBot = sender?.type === "agent_bot";
  const direction = inferDirection(msgSlice.message_type ?? payload.message_type);
  const { contentType, contentText } = mapChatwootContent(msgSlice);
  const sentAt = parseChatwootDate(
    msgSlice.created_at ?? msgSlice.updated_at ?? payload.created_at
  );

  const [insertedMsg] = await db
    .insert(conversationMessages)
    .values({
      tenantId,
      conversationId,
      externalId: messageId,
      direction,
      sentByBot,
      contentType,
      contentText,
      payload: msgSlice,
      sentAt,
    })
    .onConflictDoNothing()
    .returning({ id: conversationMessages.id });

  if (insertedMsg) {
    await enqueueConversationClassification({ tenantId, conversationId });
  }

  await db
    .update(chatwootWebhookEvents)
    .set({ processedAt: new Date() })
    .where(eq(chatwootWebhookEvents.id, rawEventId));

  return { ok: true };
}
