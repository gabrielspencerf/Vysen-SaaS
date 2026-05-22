import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { whatsappCloudWebhookEvents } from "@/db/schema";
import { getSharedRedis } from "@/server/redis";
import { enqueue } from "@/workers/queue";
import type { JobProcessWhatsappCloudRaw } from "@/workers/queue/types";

export interface WhatsappCloudIngestInput {
  tenantId: string;
  whatsappCloudNumberId: string;
  eventType: string;
  payload: Record<string, unknown>;
  externalEventId: string | null;
}

export async function ingestWhatsappCloudWebhook(
  input: WhatsappCloudIngestInput
): Promise<{ rawEventId: string } | { error: string }> {
  const db = getDb();

  let inserted: { id: string } | undefined;
  try {
    [inserted] = await db
      .insert(whatsappCloudWebhookEvents)
      .values({
        tenantId: input.tenantId,
        whatsappCloudNumberId: input.whatsappCloudNumberId,
        eventType: input.eventType,
        payload: input.payload,
        externalEventId: input.externalEventId,
        receivedAt: new Date(),
      })
      .returning({ id: whatsappCloudWebhookEvents.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("wc_webhook_events_dedup_unique")) {
      throw err;
    }
  }

  if (!inserted && input.externalEventId) {
    const [existing] = await db
      .select({ id: whatsappCloudWebhookEvents.id })
      .from(whatsappCloudWebhookEvents)
      .where(
        and(
          eq(whatsappCloudWebhookEvents.tenantId, input.tenantId),
          eq(whatsappCloudWebhookEvents.whatsappCloudNumberId, input.whatsappCloudNumberId),
          eq(whatsappCloudWebhookEvents.externalEventId, input.externalEventId)
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
  const job: JobProcessWhatsappCloudRaw = {
    type: "process_whatsapp_cloud_raw",
    rawEventId: inserted.id,
    tenantId: input.tenantId,
    whatsappCloudNumberId: input.whatsappCloudNumberId,
  };
  await enqueue(redis, job);

  return { rawEventId: inserted.id };
}
