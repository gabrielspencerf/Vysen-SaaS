import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";

export interface VysenUsageLogInput {
  tenantId?: string | null;
  userId?: string | null;
  channel: "admin" | "dashboard";
  operation: "copilot_chat" | "classification";
  model?: string | null;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  success: boolean;
  errorMessage?: string | null;
}

export interface VysenAdminUsageMetrics {
  totalRequests24h: number;
  successfulRequests24h: number;
  failedRequests24h: number;
  successRatePercent24h: number;
  totalTokens24h: number;
  promptTokens24h: number;
  completionTokens24h: number;
  uniqueUsers24h: number;
  tokensByUserTop: Array<{ userId: string; totalTokens: number; requests: number }>;
  recentFailures: Array<{
    createdAt: string;
    tenantId: string | null;
    userId: string | null;
    operation: string;
    errorMessage: string | null;
  }>;
}

export async function logVysenUsage(input: VysenUsageLogInput): Promise<void> {
  const db = getDb();
  try {
    await db.execute(sql`
      INSERT INTO vysen_usage_events (
        tenant_id,
        user_id,
        channel,
        operation,
        model,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        success,
        error_message
      ) VALUES (
        ${input.tenantId ?? null},
        ${input.userId ?? null},
        ${input.channel},
        ${input.operation},
        ${input.model ?? null},
        ${Math.max(0, Math.floor(input.promptTokens ?? 0))},
        ${Math.max(0, Math.floor(input.completionTokens ?? 0))},
        ${Math.max(0, Math.floor(input.totalTokens ?? 0))},
        ${input.success},
        ${input.errorMessage ? input.errorMessage.slice(0, 500) : null}
      )
    `);
  } catch {
    // Não interrompe fluxo principal se telemetria falhar.
  }
}

export async function getVysenAdminUsageMetrics(): Promise<VysenAdminUsageMetrics> {
  const db = getDb();
  try {
    const [totalsRows, topUsersRows, failuresRows] = await Promise.all([
      db.execute<{
        totalRequests: string;
        successfulRequests: string;
        failedRequests: string;
        totalTokens: string;
        promptTokens: string;
        completionTokens: string;
        uniqueUsers: string;
      }>(sql`
        SELECT
          count(*)::text AS "totalRequests",
          count(*) FILTER (WHERE success = true)::text AS "successfulRequests",
          count(*) FILTER (WHERE success = false)::text AS "failedRequests",
          coalesce(sum(total_tokens), 0)::text AS "totalTokens",
          coalesce(sum(prompt_tokens), 0)::text AS "promptTokens",
          coalesce(sum(completion_tokens), 0)::text AS "completionTokens",
          count(distinct user_id)::text AS "uniqueUsers"
        FROM vysen_usage_events
        WHERE created_at >= now() - interval '24 hours'
      `),
      db.execute<{ userId: string; totalTokens: string; requests: string }>(sql`
        SELECT
          coalesce(user_id::text, 'system') AS "userId",
          coalesce(sum(total_tokens), 0)::text AS "totalTokens",
          count(*)::text AS "requests"
        FROM vysen_usage_events
        WHERE created_at >= now() - interval '24 hours'
        GROUP BY user_id
        ORDER BY sum(total_tokens) DESC
        LIMIT 5
      `),
      db.execute<{
        createdAt: Date;
        tenantId: string | null;
        userId: string | null;
        operation: string;
        errorMessage: string | null;
      }>(sql`
        SELECT
          created_at AS "createdAt",
          tenant_id::text AS "tenantId",
          user_id::text AS "userId",
          operation AS "operation",
          error_message AS "errorMessage"
        FROM vysen_usage_events
        WHERE success = false
        ORDER BY created_at DESC
        LIMIT 10
      `),
    ]);

    const totals = (totalsRows as unknown as Array<{
      totalRequests: string;
      successfulRequests: string;
      failedRequests: string;
      totalTokens: string;
      promptTokens: string;
      completionTokens: string;
      uniqueUsers: string;
    }>)[0] ?? {
      totalRequests: "0",
      successfulRequests: "0",
      failedRequests: "0",
      totalTokens: "0",
      promptTokens: "0",
      completionTokens: "0",
      uniqueUsers: "0",
    };

    const totalRequests24h = Number(totals.totalRequests ?? 0);
    const successfulRequests24h = Number(totals.successfulRequests ?? 0);
    const failedRequests24h = Number(totals.failedRequests ?? 0);

    return {
      totalRequests24h,
      successfulRequests24h,
      failedRequests24h,
      successRatePercent24h:
        totalRequests24h > 0 ? Math.round((successfulRequests24h / totalRequests24h) * 100) : 100,
      totalTokens24h: Number(totals.totalTokens ?? 0),
      promptTokens24h: Number(totals.promptTokens ?? 0),
      completionTokens24h: Number(totals.completionTokens ?? 0),
      uniqueUsers24h: Number(totals.uniqueUsers ?? 0),
      tokensByUserTop: (topUsersRows as unknown as Array<{
        userId: string;
        totalTokens: string;
        requests: string;
      }>).map((row) => ({
        userId: row.userId,
        totalTokens: Number(row.totalTokens ?? 0),
        requests: Number(row.requests ?? 0),
      })),
      recentFailures: (failuresRows as unknown as Array<{
        createdAt: Date;
        tenantId: string | null;
        userId: string | null;
        operation: string;
        errorMessage: string | null;
      }>).map((row) => ({
        createdAt: row.createdAt.toISOString(),
        tenantId: row.tenantId,
        userId: row.userId,
        operation: row.operation,
        errorMessage: row.errorMessage,
      })),
    };
  } catch {
    return {
      totalRequests24h: 0,
      successfulRequests24h: 0,
      failedRequests24h: 0,
      successRatePercent24h: 100,
      totalTokens24h: 0,
      promptTokens24h: 0,
      completionTokens24h: 0,
      uniqueUsers24h: 0,
      tokensByUserTop: [],
      recentFailures: [],
    };
  }
}

/**
 * Apaga eventos vysen_usage_events mais antigos que `retentionDays` (default
 * 90 dias, configurável via env VYSEN_USAGE_RETENTION_DAYS).
 *
 * Por que existe: a tabela cresce sem limite — cada chat do copilot grava
 * 1-3 linhas, fácil chegar a milhões/ano em tenant ativo. Sem retention,
 * índices ficam pesados e dashboards de "últimas N horas" começam a varrer
 * mais do que precisam. Particionamento por mês é o passo seguinte; por
 * enquanto, retention simples cobre o caso comum.
 *
 * Retorna o número de linhas removidas. Falha de query não derruba o caller —
 * loga e retorna 0.
 */
export async function cleanupVysenUsageEvents(): Promise<{ removed: number }> {
  const days = Number(process.env.VYSEN_USAGE_RETENTION_DAYS ?? "90");
  const retentionDays = Number.isFinite(days) && days >= 1 ? Math.floor(days) : 90;
  try {
    const db = getDb();
    const result = (await db.execute<{ count: number }>(sql`
      WITH deleted AS (
        DELETE FROM "vysen_usage_events"
        WHERE "created_at" < (now() - (${retentionDays} || ' days')::interval)
        RETURNING 1
      )
      SELECT COUNT(*)::int AS count FROM deleted
    `)) as unknown as Array<{ count: number }>;
    const removed = Number(result[0]?.count ?? 0);
    return { removed };
  } catch (err) {
    console.warn(
      "[vysen-usage-retention] cleanup falhou",
      err instanceof Error ? err.message : String(err)
    );
    return { removed: 0 };
  }
}

