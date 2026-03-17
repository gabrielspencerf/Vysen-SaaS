/**
 * Persistir evento em uazapi_webhook_events e publicar job na fila Redis.
 * Paridade com Evolution (ingestEvolutionWebhook).
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { uazapiWebhookEvents } from "@/db/schema";
import { createRedisClient } from "@/server/redis";
import { enqueue } from "@/workers/queue";
import type { JobProcessUazapiRaw } from "@/workers/queue/types";

export interface UazapiIngestInput {
  tenantId: string;
  uazapiInstanceId: string;
  eventType: string;
  payload: Record<string, unknown>;
  externalEventId: string | null;
}

export async function ingestUazapiWebhook(
  input: UazapiIngestInput
): Promise<{ rawEventId: string } | { error: string }> {
  const db = getDb();

  let inserted: { id: string } | undefined;
  try {
    [inserted] = await db
      .insert(uazapiWebhookEvents)
      .values({
        tenantId: input.tenantId,
        uazapiInstanceId: input.uazapiInstanceId,
        eventType: input.eventType,
        payload: input.payload,
        externalEventId: input.externalEventId,
        receivedAt: new Date(),
      })
      .returning({ id: uazapiWebhookEvents.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("uazapi_webhook_events_dedup_unique")) {
      throw err;
    }
  }

  if (!inserted && input.externalEventId) {
    const [existing] = await db
      .select({ id: uazapiWebhookEvents.id })
      .from(uazapiWebhookEvents)
      .where(
        and(
          eq(uazapiWebhookEvents.tenantId, input.tenantId),
          eq(uazapiWebhookEvents.uazapiInstanceId, input.uazapiInstanceId),
          eq(uazapiWebhookEvents.externalEventId, input.externalEventId)
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

  const redis = createRedisClient();
  try {
    const job: JobProcessUazapiRaw = {
      type: "process_uazapi_raw",
      rawEventId: inserted.id,
      tenantId: input.tenantId,
      uazapiInstanceId: input.uazapiInstanceId,
    };
    await enqueue(redis, job);
  } finally {
    redis.quit();
  }

  return { rawEventId: inserted.id };
}
