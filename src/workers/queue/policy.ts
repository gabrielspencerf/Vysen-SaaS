import type { JobPayload } from "./types";

export type QueueCriticality = "p0" | "p1" | "p2";

export interface QueuePolicy {
  criticality: QueueCriticality;
  sloTargetSeconds: number;
  maxAttempts: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
}

const POLICY_P0: QueuePolicy = {
  criticality: "p0",
  sloTargetSeconds: 30,
  maxAttempts: 6,
  baseBackoffMs: 1_000,
  maxBackoffMs: 20_000,
};

const POLICY_P1: QueuePolicy = {
  criticality: "p1",
  sloTargetSeconds: 120,
  maxAttempts: 5,
  baseBackoffMs: 2_000,
  maxBackoffMs: 30_000,
};

const POLICY_P2: QueuePolicy = {
  criticality: "p2",
  sloTargetSeconds: 300,
  maxAttempts: 4,
  baseBackoffMs: 5_000,
  maxBackoffMs: 60_000,
};

export function getQueuePolicy(job: JobPayload): QueuePolicy {
  switch (job.type) {
    case "process_typebot_raw":
    case "process_evolution_raw":
    case "process_uazapi_raw":
    case "process_chatwoot_raw":
    case "process_whatsapp_cloud_raw":
      return POLICY_P0;
    case "sync_google_ads_account":
    case "sync_meta_ads_account":
    case "sync_clarity_connection":
    case "process_due_followups_tenant":
      return POLICY_P1;
    case "classify_conversation":
      return POLICY_P2;
    default: {
      const exhaustive: never = job;
      throw new Error(`Queue policy ausente para job: ${(exhaustive as { type?: string }).type}`);
    }
  }
}

/**
 * Backoff exponencial COM jitter (±30%). Sem o jitter, todos os jobs retentam no
 * mesmo instante após uma falha sistêmica (ex.: OpenAI 429) — thundering herd.
 */
export function computeBackoffMs(attempt: number, policy: QueuePolicy): number {
  const normalizedAttempt = Math.max(1, attempt);
  const exp = Math.min(6, normalizedAttempt - 1);
  const base = policy.baseBackoffMs * 2 ** exp;
  const capped = Math.min(policy.maxBackoffMs, base);
  // Jitter multiplicativo em [0.7, 1.3].
  const jitterFactor = 0.7 + Math.random() * 0.6;
  return Math.max(policy.baseBackoffMs, Math.floor(capped * jitterFactor));
}
