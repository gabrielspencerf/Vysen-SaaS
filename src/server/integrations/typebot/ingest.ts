/**
 * Persistir evento em typebot_webhook_events e publicar job na fila Redis.
 * Idempotência: se external_event_id informado e já existir registro (tenant_id, typebot_bot_id, external_event_id), retorna 200 sem inserir nem enfileirar de novo.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { typebotWebhookEvents } from "@/db/schema";
import { getSharedRedis } from "@/server/redis";
import { enqueue } from "@/workers/queue";
import type { JobProcessTypebotRaw } from "@/workers/queue/types";

export interface TypebotIngestInput {
  tenantId: string;
  typebotBotId: string;
  payload: Record<string, unknown>;
  externalEventId: string | null;
}

export async function ingestTypebotWebhook(
  input: TypebotIngestInput
): Promise<{ rawEventId: string } | { error: string }> {
  const db = getDb();

  let inserted: { id: string } | undefined;
  try {
    [inserted] = await db
      .insert(typebotWebhookEvents)
      .values({
        tenantId: input.tenantId,
        typebotBotId: input.typebotBotId,
        externalEventId: input.externalEventId,
        payload: input.payload,
        receivedAt: new Date(),
      })
      .returning({ id: typebotWebhookEvents.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("typebot_webhook_events_dedup_unique")) {
      throw err;
    }
  }

  if (!inserted && input.externalEventId) {
    const [existing] = await db
      .select({ id: typebotWebhookEvents.id })
      .from(typebotWebhookEvents)
      .where(
        and(
          eq(typebotWebhookEvents.tenantId, input.tenantId),
          eq(typebotWebhookEvents.typebotBotId, input.typebotBotId),
          eq(typebotWebhookEvents.externalEventId, input.externalEventId)
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
  const job: JobProcessTypebotRaw = {
    type: "process_typebot_raw",
    rawEventId: inserted.id,
    tenantId: input.tenantId,
    typebotBotId: input.typebotBotId,
  };
  await enqueue(redis, job);

  return { rawEventId: inserted.id };
}
