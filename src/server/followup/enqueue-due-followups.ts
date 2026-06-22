import { enqueue } from "@/workers/queue";
import { createRedisClient } from "@/server/redis";

const FOLLOWUP_DUE_LOCK_KEY = (tenantId: string) =>
  `lock:followup:due:tenant:${tenantId}`;

/**
 * Evita enfileirar muitos jobs de "process due follow-ups" para o mesmo tenant.
 * O MVP roda notify-first; aqui garantimos que o engine não varra o DB repetidamente.
 */
export async function enqueueDueFollowupsForTenant(tenantId: string): Promise<void> {
  if (!process.env.REDIS_URL) return;
  const redis = createRedisClient();
  try {
    const lockKey = FOLLOWUP_DUE_LOCK_KEY(tenantId);
    const locked = await redis.set(lockKey, "1", "EX", 90, "NX");
    if (!locked) return;

    await enqueue(redis, {
      type: "process_due_followups_tenant",
      tenantId,
    });
  } finally {
    await redis.quit().catch(() => {});
  }
}

