/**
 * Persistir evento em evolution_webhook_events e publicar job na fila Redis.
 * Retorna { rawEventId } ou { error }; não aguarda processamento.
 * Idempotência: se external_event_id informado e já existir (tenant_id, evolution_instance_id, external_event_id), retorna id existente sem inserir nem enfileirar.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { evolutionWebhookEvents } from "@/db/schema";
import { getSharedRedis } from "@/server/redis";
import { enqueue } from "@/workers/queue";
import type { JobProcessEvolutionRaw } from "@/workers/queue/types";

export interface EvolutionIngestInput {
  tenantId: string;
  evolutionInstanceId: string;
  eventType: string;
  payload: Record<string, unknown>;
  externalEventId: string | null;
}

export async function ingestEvolutionWebhook(
  input: EvolutionIngestInput
): Promise<{ rawEventId: string } | { error: string }> {
  const db = getDb();

  let inserted: { id: string } | undefined;
  try {
    [inserted] = await db
      .insert(evolutionWebhookEvents)
      .values({
        tenantId: input.tenantId,
        evolutionInstanceId: input.evolutionInstanceId,
        eventType: input.eventType,
        payload: input.payload,
        externalEventId: input.externalEventId,
        receivedAt: new Date(),
      })
      .returning({ id: evolutionWebhookEvents.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("evolution_webhook_events_dedup_unique")) {
      throw err;
    }
  }

  if (!inserted && input.externalEventId) {
    const [existing] = await db
      .select({ id: evolutionWebhookEvents.id })
      .from(evolutionWebhookEvents)
      .where(
        and(
          eq(evolutionWebhookEvents.tenantId, input.tenantId),
          eq(evolutionWebhookEvents.evolutionInstanceId, input.evolutionInstanceId),
          eq(evolutionWebhookEvents.externalEventId, input.externalEventId)
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
  const job: JobProcessEvolutionRaw = {
    type: "process_evolution_raw",
    rawEventId: inserted.id,
    tenantId: input.tenantId,
    evolutionInstanceId: input.evolutionInstanceId,
  };
  await enqueue(redis, job);

  return { rawEventId: inserted.id };
}
