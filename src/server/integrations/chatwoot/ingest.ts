import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { chatwootWebhookEvents } from "@/db/schema";
import { getSharedRedis } from "@/server/redis";
import { enqueue } from "@/workers/queue";
import type { JobProcessChatwootRaw } from "@/workers/queue/types";

export interface ChatwootIngestInput {
  tenantId: string;
  chatwootAccountId: string;
  eventType: string;
  payload: Record<string, unknown>;
  externalEventId: string | null;
}

export async function ingestChatwootWebhook(
  input: ChatwootIngestInput
): Promise<{ rawEventId: string } | { error: string }> {
  const db = getDb();

  let inserted: { id: string } | undefined;
  try {
    [inserted] = await db
      .insert(chatwootWebhookEvents)
      .values({
        tenantId: input.tenantId,
        chatwootAccountId: input.chatwootAccountId,
        eventType: input.eventType,
        payload: input.payload,
        externalEventId: input.externalEventId,
        receivedAt: new Date(),
      })
      .returning({ id: chatwootWebhookEvents.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("chatwoot_webhook_events_dedup_unique")) {
      throw err;
    }
  }

  if (!inserted && input.externalEventId) {
    const [existing] = await db
      .select({ id: chatwootWebhookEvents.id })
      .from(chatwootWebhookEvents)
      .where(
        and(
          eq(chatwootWebhookEvents.tenantId, input.tenantId),
          eq(chatwootWebhookEvents.chatwootAccountId, input.chatwootAccountId),
          eq(chatwootWebhookEvents.externalEventId, input.externalEventId)
        )
      )
      .limit(1);
    if (existing) {
      return { rawEventId: existing.id };
    }
  }

  if (!inserted) {
    return { error: "Failed to persist event" };
  }

  const redis = getSharedRedis();
  const job: JobProcessChatwootRaw = {
    type: "process_chatwoot_raw",
    rawEventId: inserted.id,
    tenantId: input.tenantId,
    chatwootAccountId: input.chatwootAccountId,
  };
  await enqueue(redis, job);

  return { rawEventId: inserted.id };
}
