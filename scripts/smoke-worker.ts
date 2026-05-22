import { readFileSync } from "node:fs";
import path from "node:path";

function readRequired(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function assertIncludes(content: string, needle: string, message: string): void {
  if (!content.includes(needle)) {
    throw new Error(message);
  }
}

function main(): void {
  const queueTypes = readRequired("src/workers/queue/types.ts");
  const requiredQueues = [
    "QUEUE_RAW_TYPEBOT",
    "QUEUE_RAW_EVOLUTION",
    "QUEUE_RAW_UAZAPI",
    "QUEUE_RAW_CHATWOOT",
    "QUEUE_RAW_WHATSAPP_CLOUD",
    "QUEUE_SYNC_GOOGLE_ADS",
    "QUEUE_SYNC_META_ADS",
    "QUEUE_SYNC_CLARITY",
    "QUEUE_AI_CLASSIFICATION",
    "QUEUE_FOLLOWUP_DUE_TENANT",
  ];

  for (const queue of requiredQueues) {
    assertIncludes(queueTypes, queue, `fila ausente no contrato: ${queue}`);
  }

  const runner = readRequired("src/workers/runner.ts");
  const requiredConsumers = [
    "runTypebotConsumer",
    "runEvolutionConsumer",
    "runUazapiConsumer",
    "runChatwootConsumer",
    "runWhatsappCloudConsumer",
    "runGoogleAdsSyncConsumer",
    "runMetaAdsSyncConsumer",
    "runClaritySyncConsumer",
    "runAiClassificationConsumer",
    "runDueFollowupsConsumer",
  ];
  for (const consumer of requiredConsumers) {
    assertIncludes(runner, consumer, `consumer ausente no runner: ${consumer}`);
  }
  assertIncludes(
    runner,
    "cleanupExpiredAuthArtifacts",
    "runner deve executar cleanup periodico de auth"
  );
  // Estabilização (lote workers 2026-05): garantir visibility lock + retry persistente +
  // schedulers + graceful shutdown.
  assertIncludes(runner, "dequeueWithLock", "runner deve usar dequeueWithLock (visibility)");
  assertIncludes(runner, "enqueueDelayed", "runner deve agendar retries via enqueueDelayed");
  assertIncludes(runner, "promoteDueDelayedJobs", "runner deve promover jobs delayed");
  assertIncludes(runner, "reapStaleProcessing", "runner deve rodar reaper");
  assertIncludes(runner, "shuttingDown", "runner deve ter flag de shutdown");

  const readiness = readRequired("src/workers/readiness.ts");
  assertIncludes(readiness, "HEARTBEAT_KEY", "readiness deve expor HEARTBEAT_KEY");
  assertIncludes(readiness, "MAX_AGE_MS", "readiness deve expor MAX_AGE_MS");

  const workerReadinessScript = readRequired("scripts/worker-readiness.ts");
  assertIncludes(
    workerReadinessScript,
    "checkReadiness",
    "script de readiness deve validar heartbeat do worker"
  );

  console.log("[smoke:worker] ok");
}

main();
