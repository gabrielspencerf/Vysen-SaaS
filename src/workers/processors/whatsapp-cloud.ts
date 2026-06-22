/**
 * Processador: raw event WhatsApp Cloud → conversations / conversation_messages.
 * `conversations.external_id` = wa_id do contato (dígitos), alinhado à spec Fase A.
 * Evento `statuses`: apenas marca raw como processado (MVP sem atualização de status de linha).
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  whatsappCloudWebhookEvents,
  conversations,
  conversationMessages,
} from "@/db/schema";
import type { JobProcessWhatsappCloudRaw } from "../queue/types";
import { findOrCreateContactFromWaId } from "@/server/integrations/conversation-contact";
import { enqueueConversationClassification } from "@/server/ai/enqueue-classification";

const CONVERSATION_STATUS_OPEN = "open";

function stringOrNull(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function collectValueBlocks(payload: Record<string, unknown>): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  for (const ent of entries) {
    if (!ent || typeof ent !== "object") continue;
    const changes = Array.isArray((ent as Record<string, unknown>).changes)
      ? ((ent as Record<string, unknown>).changes as unknown[])
      : [];
    for (const ch of changes) {
      if (!ch || typeof ch !== "object") continue;
      const v = (ch as Record<string, unknown>).value;
      if (v && typeof v === "object") out.push(v as Record<string, unknown>);
    }
  }
  return out;
}

function waNameMap(value: Record<string, unknown>): Map<string, string> {
  const map = new Map<string, string>();
  const list = Array.isArray(value.contacts) ? value.contacts : [];
  for (const c of list) {
    if (!c || typeof c !== "object") continue;
    const rec = c as Record<string, unknown>;
    const waRaw = stringOrNull(String(rec.wa_id ?? "")) ?? "";
    const digits = waRaw.replace(/\D/g, "");
    if (!digits) continue;
    const profile = rec.profile;
    const name =
      profile && typeof profile === "object"
        ? stringOrNull((profile as Record<string, unknown>).name as string)
        : null;
    if (name) map.set(digits, name);
  }
  return map;
}

function extractWcMessageParts(msg: Record<string, unknown>): {
  contentType: "text" | "audio" | "image";
  contentText: string | null;
} {
  const type = stringOrNull(msg.type)?.toLowerCase() ?? "text";
  if (type === "text") {
    const t = msg.text as Record<string, unknown> | undefined;
    return { contentType: "text", contentText: t ? stringOrNull(t.body as string) : null };
  }
  if (type === "image") {
    const img = msg.image as Record<string, unknown> | undefined;
    return {
      contentType: "image",
      contentText: img ? stringOrNull(img.caption as string) : null,
    };
  }
  if (type === "audio") {
    return { contentType: "audio", contentText: null };
  }
  if (type === "interactive") {
    const inter = msg.interactive as Record<string, unknown> | undefined;
    const body = inter?.body as Record<string, unknown> | undefined;
    return {
      contentType: "text",
      contentText: body ? stringOrNull(body.text as string) : `[interactive]`,
    };
  }
  if (type === "button") {
    const btn = msg.button as Record<string, unknown> | undefined;
    return {
      contentType: "text",
      contentText: btn ? stringOrNull(btn.text as string) : `[button]`,
    };
  }
  return { contentType: "text", contentText: `[${type}]` };
}

function parseUnixSeconds(v: unknown): Date {
  if (typeof v === "string" && /^\d+$/.test(v.trim())) {
    const n = Number(v.trim());
    return new Date(n * 1000);
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    return new Date(v < 1e12 ? v * 1000 : v);
  }
  return new Date();
}

export async function processWhatsappCloudRaw(
  job: JobProcessWhatsappCloudRaw
): Promise<{ ok: true } | { error: string }> {
  const db = getDb();
  const { rawEventId } = job;

  try {
    return await processWhatsappCloudRawInner(db, job);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(whatsappCloudWebhookEvents)
      .set({
        processingError: msg.slice(0, 1024),
        processedAt: new Date(),
      })
      .where(eq(whatsappCloudWebhookEvents.id, rawEventId));
    return { error: msg };
  }
}

async function processWhatsappCloudRawInner(
  db: ReturnType<typeof getDb>,
  job: JobProcessWhatsappCloudRaw
): Promise<{ ok: true } | { error: string }> {
  const { rawEventId, tenantId, whatsappCloudNumberId } = job;

  const [raw] = await db
    .select()
    .from(whatsappCloudWebhookEvents)
    .where(
      and(
        eq(whatsappCloudWebhookEvents.id, rawEventId),
        eq(whatsappCloudWebhookEvents.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!raw) return { error: `Raw event not found: ${rawEventId}` };
  if (raw.processedAt) return { ok: true };

  const eventType = raw.eventType;
  if (eventType === "statuses") {
    await db
      .update(whatsappCloudWebhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(whatsappCloudWebhookEvents.id, rawEventId));
    return { ok: true };
  }

  if (eventType !== "messages") {
    await db
      .update(whatsappCloudWebhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(whatsappCloudWebhookEvents.id, rawEventId));
    return { ok: true };
  }

  const payload = raw.payload as Record<string, unknown>;
  const values = collectValueBlocks(payload);
  const now = new Date();
  let hadError: string | null = null;
  let handledAnyMessage = false;

  for (const value of values) {
    const messages = Array.isArray(value.messages) ? value.messages : [];
    if (messages.length === 0) continue;

    const names = waNameMap(value);

    for (const m of messages) {
      if (!m || typeof m !== "object") continue;
      const msg = m as Record<string, unknown>;
      const fromDigits =
        stringOrNull(msg.from as string)?.replace(/\D/g, "") ?? "";
      const toDigits =
        stringOrNull(msg.to as string)?.replace(/\D/g, "") ?? "";

      let customerWa: string;
      let direction: "in" | "out";
      if (fromDigits) {
        customerWa = fromDigits;
        direction = "in";
      } else if (toDigits) {
        customerWa = toDigits;
        direction = "out";
      } else {
        hadError = hadError ?? "Missing wa_id (from/to)";
        continue;
      }

      const messageId = stringOrNull(String(msg.id ?? ""));
      if (!messageId) {
        hadError = hadError ?? "Missing message id";
        continue;
      }

      const displayName = names.get(customerWa) ?? null;
      const contactId = await findOrCreateContactFromWaId({
        tenantId,
        waId: customerWa,
        displayName,
      });

      let conversationId: string;
      const [existingConv] = await db
        .select({
          id: conversations.id,
          contactId: conversations.contactId,
        })
        .from(conversations)
        .where(
          and(
            eq(conversations.tenantId, tenantId),
            eq(conversations.whatsappCloudNumberId, whatsappCloudNumberId),
            eq(conversations.externalId, customerWa)
          )
        )
        .limit(1);

      const sentAt = parseUnixSeconds(msg.timestamp);

      if (existingConv) {
        conversationId = existingConv.id;
        await db
          .update(conversations)
          .set({
            lastSyncedAt: now,
            updatedAt: now,
            ...(contactId && !existingConv.contactId ? { contactId } : {}),
          })
          .where(eq(conversations.id, conversationId));
      } else {
        const [inserted] = await db
          .insert(conversations)
          .values({
            tenantId,
            whatsappCloudNumberId,
            contactId,
            externalId: customerWa,
            status: CONVERSATION_STATUS_OPEN,
            startedAt: sentAt,
            lastSyncedAt: now,
          })
          .returning({ id: conversations.id });
        if (!inserted) {
          hadError = hadError ?? "Failed to create conversation";
          continue;
        }
        conversationId = inserted.id;
      }

      {
        const { contentType, contentText } = extractWcMessageParts(msg);
        const [insertedMsg] = await db
          .insert(conversationMessages)
          .values({
            tenantId,
            conversationId,
            externalId: messageId,
            direction,
            sentByBot: false,
            contentType,
            contentText,
            payload: msg,
            sentAt,
          })
          .onConflictDoNothing()
          .returning({ id: conversationMessages.id });

        if (insertedMsg) {
          await enqueueConversationClassification({ tenantId, conversationId });
        }
      }

      handledAnyMessage = true;
    }
  }

  const totalMessages = values.reduce(
    (n, v) => n + (Array.isArray(v.messages) ? v.messages.length : 0),
    0
  );

  if (totalMessages > 0 && !handledAnyMessage && hadError) {
    await db
      .update(whatsappCloudWebhookEvents)
      .set({
        processingError: hadError.slice(0, 1024),
        processedAt: new Date(),
      })
      .where(eq(whatsappCloudWebhookEvents.id, rawEventId));
    return { error: hadError };
  }

  await db
    .update(whatsappCloudWebhookEvents)
    .set({
      processedAt: new Date(),
      processingError: null,
    })
    .where(eq(whatsappCloudWebhookEvents.id, rawEventId));

  return { ok: true };
}
