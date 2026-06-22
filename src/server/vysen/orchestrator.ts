import { sql } from "drizzle-orm";
import {
  aiClassifications,
  followupTasks,
  internalNotifications,
  leads,
  opportunities,
} from "@/db/schema";
import { getDb } from "@/server/db";
import { getObservabilitySnapshot } from "@/server/admin/observability";
import { getVysenAdminUsageMetrics } from "@/server/vysen/usage";

type DomainHealth = "ok" | "warning" | "critical";

export interface VysenActionRecommendation {
  title: string;
  reason: string;
  confidence: number;
  suggestedLeadStatus: string | null;
  suggestedOpportunityStage: string | null;
  evidence: string[];
}

export interface VysenAdminInsights {
  generatedAt: string;
  periodDays: number;
  kpis: {
    totalTokens24h: number;
    promptTokens24h: number;
    completionTokens24h: number;
    totalRequests24h: number;
    successfulRequests24h: number;
    failedRequests24h: number;
    successRatePercent24h: number;
    uniqueUsers24h: number;
  };
  health: {
    platform: DomainHealth;
    aiReliability: DomainHealth;
    operations: DomainHealth;
  };
  alerts: string[];
  tokensByUserTop: Array<{ userId: string; totalTokens: number; requests: number }>;
  recentFailures: Array<{
    createdAt: string;
    tenantId: string | null;
    userId: string | null;
    operation: string;
    errorMessage: string | null;
  }>;
}

export interface VysenTenantInsights {
  generatedAt: string;
  periodDays: number;
  tenantId: string;
  kpis: {
    classificationsLast24h: number;
    pendingFollowups: number;
    unreadNotifications: number;
    totalAdsSpend: number;
    wonRevenue: number;
    activeLeads: number;
    openOpportunities: number;
  };
  health: {
    commercial: DomainHealth;
    acquisition: DomainHealth;
    operations: DomainHealth;
  };
  alerts: string[];
  opportunities: string[];
  bottlenecks: string[];
  wins: string[];
  negotiationInsights: {
    closingIntent: "high" | "medium" | "low";
    dominantStage: string;
    lossRatePercent: number;
    noResponseRatePercent: number;
  };
  recommendations: VysenActionRecommendation[];
}

async function safeCount(queryFn: () => Promise<{ count: number }[]>) {
  try {
    const rows = await queryFn();
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

async function safeNumberResult(
  queryFn: () => Promise<{ value: string | number | null }[]>
) {
  try {
    const rows = await queryFn();
    return Number(rows[0]?.value ?? 0);
  } catch {
    return 0;
  }
}

function classifyDomainHealth(params: {
  lossRatePercent: number;
  noResponseRatePercent: number;
  queueDepth: number;
  unreadNotifications: number;
  roas: number | null;
}): VysenTenantInsights["health"] {
  const commercial: DomainHealth =
    params.lossRatePercent > 45 || params.noResponseRatePercent > 40
      ? "critical"
      : params.lossRatePercent > 25 || params.noResponseRatePercent > 20
        ? "warning"
        : "ok";
  const acquisition: DomainHealth =
    params.roas !== null && params.roas < 1
      ? "critical"
      : params.roas !== null && params.roas < 2
        ? "warning"
        : "ok";
  const operations: DomainHealth =
    params.queueDepth > 100 || params.unreadNotifications > 50
      ? "critical"
      : params.queueDepth > 20 || params.unreadNotifications > 10
        ? "warning"
        : "ok";
  return { commercial, acquisition, operations };
}

export async function getVysenAdminInsights(periodDays = 30): Promise<VysenAdminInsights> {
  const snapshot = await getObservabilitySnapshot();
  const usage = await getVysenAdminUsageMetrics();
  const queueDepth =
    snapshot.queue.aiClassificationDepth +
    snapshot.queue.evolutionDepth +
    snapshot.queue.typebotDepth +
    snapshot.queue.uazapiDepth +
    snapshot.queue.googleAdsDepth;
  const health: VysenAdminInsights["health"] = {
    platform:
      snapshot.services.db === "error" || snapshot.services.redis === "error" ? "critical" : "ok",
    aiReliability:
      usage.successRatePercent24h < 70
        ? "critical"
        : usage.successRatePercent24h < 90
          ? "warning"
          : "ok",
    operations:
      snapshot.services.worker === "ok" && queueDepth < 100
        ? "ok"
        : snapshot.services.worker === "missing" || queueDepth > 300
          ? "critical"
          : "warning",
  };

  const alerts: string[] = [];
  if (snapshot.services.db === "error") {
    alerts.push("Banco com falha de conectividade.");
  }
  if (snapshot.services.redis === "error") {
    alerts.push("Redis indisponível para leitura operacional.");
  }
  if (snapshot.services.worker !== "ok") {
    alerts.push(`Worker com status ${snapshot.services.worker}.`);
  }
  if (usage.failedRequests24h > 0) {
    alerts.push(`${usage.failedRequests24h} chamadas da Vysen falharam nas últimas 24h.`);
  }
  if (usage.totalTokens24h === 0) {
    alerts.push("Sem consumo de tokens da Vysen nas últimas 24h.");
  }
  if (alerts.length === 0) alerts.push("Estrutura geral estável no momento.");

  return {
    generatedAt: new Date().toISOString(),
    periodDays,
    kpis: {
      totalTokens24h: usage.totalTokens24h,
      promptTokens24h: usage.promptTokens24h,
      completionTokens24h: usage.completionTokens24h,
      totalRequests24h: usage.totalRequests24h,
      successfulRequests24h: usage.successfulRequests24h,
      failedRequests24h: usage.failedRequests24h,
      successRatePercent24h: usage.successRatePercent24h,
      uniqueUsers24h: usage.uniqueUsers24h,
    },
    health,
    alerts,
    tokensByUserTop: usage.tokensByUserTop,
    recentFailures: usage.recentFailures,
  };
}

export async function getVysenTenantInsights(input: {
  tenantId: string;
  periodDays?: number;
}): Promise<VysenTenantInsights> {
  const db = getDb();
  const periodDays = input.periodDays ?? 30;
  const tenantId = input.tenantId;

  const [
    classificationsLast24h,
    pendingFollowups,
    unreadNotifications,
    totalAdsSpend,
    wonRevenue,
    activeLeads,
    openOpportunities,
  ] = await Promise.all([
    safeCount(() =>
      db
        .select({ count: sql<number>`count(*)` })
        .from(aiClassifications)
        .where(
          sql`${aiClassifications.tenantId} = ${tenantId} and ${aiClassifications.processedAt} >= ${
            new Date(Date.now() - 24 * 60 * 60 * 1000)
          } and ${aiClassifications.isCurrent} = true`
        )
    ),
    safeCount(() =>
      db
        .select({ count: sql<number>`count(*)` })
        .from(followupTasks)
        .where(sql`${followupTasks.tenantId} = ${tenantId} and ${followupTasks.status} = 'pending'`)
    ),
    safeCount(() =>
      db
        .select({ count: sql<number>`count(*)` })
        .from(internalNotifications)
        .where(
          sql`${internalNotifications.tenantId} = ${tenantId} and ${internalNotifications.isRead} = false`
        )
    ),
    safeNumberResult(() =>
      db.execute<{ value: string }>(sql`
        SELECT
          coalesce(
            sum(
              coalesce((metrics->>'cost')::numeric, (metrics->>'costMicros')::numeric / 1000000, 0)
            ),
            0
          )::text AS value
        FROM campaign_snapshots
        WHERE tenant_id = ${tenantId}
          AND period_start >= current_date - (${periodDays} * interval '1 day')
      `) as Promise<{ value: string | number | null }[]>
    ),
    safeNumberResult(() =>
      db.execute<{ value: string }>(sql`
        SELECT coalesce(sum(coalesce(job_value::numeric, 0)), 0)::text AS value
        FROM opportunities
        WHERE tenant_id = ${tenantId}
          AND stage = 'won'
          AND updated_at >= now() - (${periodDays} * interval '1 day')
      `) as Promise<{ value: string | number | null }[]>
    ),
    safeCount(() =>
      db
        .select({ count: sql<number>`count(*)` })
        .from(leads)
        .where(sql`${leads.tenantId} = ${tenantId} and ${leads.status} in ('new','contacted','qualified')`)
    ),
    safeCount(() =>
      db
        .select({ count: sql<number>`count(*)` })
        .from(opportunities)
        .where(sql`${opportunities.tenantId} = ${tenantId} and ${opportunities.stage} = 'open'`)
    ),
  ]);

  const [saleCount, lossCount, noResponseCount, totalClassifications] = await Promise.all([
    safeCount(() =>
      db
        .select({ count: sql<number>`count(*)` })
        .from(aiClassifications)
        .where(
          sql`${aiClassifications.tenantId} = ${tenantId} and ${aiClassifications.isCurrent} = true and ${aiClassifications.classificationType} = 'sale'`
        )
    ),
    safeCount(() =>
      db
        .select({ count: sql<number>`count(*)` })
        .from(aiClassifications)
        .where(
          sql`${aiClassifications.tenantId} = ${tenantId} and ${aiClassifications.isCurrent} = true and ${aiClassifications.classificationType} = 'loss'`
        )
    ),
    safeCount(() =>
      db
        .select({ count: sql<number>`count(*)` })
        .from(aiClassifications)
        .where(
          sql`${aiClassifications.tenantId} = ${tenantId} and ${aiClassifications.isCurrent} = true and ${aiClassifications.classificationType} = 'no_response'`
        )
    ),
    safeCount(() =>
      db
        .select({ count: sql<number>`count(*)` })
        .from(aiClassifications)
        .where(sql`${aiClassifications.tenantId} = ${tenantId} and ${aiClassifications.isCurrent} = true`)
    ),
  ]);

  const lossRatePercent =
    totalClassifications > 0 ? Math.round((lossCount / totalClassifications) * 100) : 0;
  const noResponseRatePercent =
    totalClassifications > 0 ? Math.round((noResponseCount / totalClassifications) * 100) : 0;
  const closingIntent: VysenTenantInsights["negotiationInsights"]["closingIntent"] =
    totalClassifications === 0
      ? "low"
      : saleCount / totalClassifications >= 0.45
        ? "high"
        : saleCount / totalClassifications >= 0.2
          ? "medium"
          : "low";
  const roas = totalAdsSpend > 0 ? wonRevenue / totalAdsSpend : null;
  const health = classifyDomainHealth({
    lossRatePercent,
    noResponseRatePercent,
    queueDepth: pendingFollowups,
    unreadNotifications,
    roas,
  });

  const alerts = [
    ...(lossRatePercent >= 30 ? [`Taxa de perda elevada (${lossRatePercent}%).`] : []),
    ...(noResponseRatePercent >= 25
      ? [`Muitas conversas sem resposta (${noResponseRatePercent}%).`]
      : []),
    ...((roas ?? 0) > 0 && (roas ?? 0) < 1.2
      ? ["ROAS abaixo do ideal para escalar aquisição."]
      : []),
  ];
  if (alerts.length === 0) {
    alerts.push("Sem alertas críticos no período atual.");
  }

  const opportunitiesList = [
    ...(pendingFollowups > 0 ? ["Priorizar follow-ups pendentes com cadência por perfil."] : []),
    ...(openOpportunities > 0
      ? ["Acelerar oportunidades abertas sem atualização recente."]
      : []),
    ...(totalAdsSpend > 0
      ? ["Realocar verba para campanhas com maior ganho em oportunidades."]
      : []),
  ];
  if (opportunitiesList.length === 0) {
    opportunitiesList.push("Consolidar baseline de aquisição e funil para próxima janela.");
  }

  return {
    generatedAt: new Date().toISOString(),
    periodDays,
    tenantId,
    kpis: {
      classificationsLast24h,
      pendingFollowups,
      unreadNotifications,
      totalAdsSpend,
      wonRevenue,
      activeLeads,
      openOpportunities,
    },
    health,
    alerts,
    opportunities: opportunitiesList,
    bottlenecks: [
      `No response: ${noResponseRatePercent}%`,
      `Perdas: ${lossRatePercent}%`,
      `Follow-ups pendentes: ${pendingFollowups}`,
    ],
    wins: [
      `Classificações 24h: ${classificationsLast24h}`,
      `Leads ativos: ${activeLeads}`,
      `Receita won: R$ ${wonRevenue.toFixed(2)}`,
    ],
    negotiationInsights: {
      closingIntent,
      dominantStage: openOpportunities > 0 ? "open" : "qualified",
      lossRatePercent,
      noResponseRatePercent,
    },
    recommendations: [
      {
        title: "Reclassificar leads de baixa resposta",
        reason: "Ajustar status melhora previsibilidade do funil e priorização do time.",
        confidence: noResponseRatePercent >= 20 ? 0.82 : 0.68,
        suggestedLeadStatus: "contacted",
        suggestedOpportunityStage: "open",
        evidence: [
          `No response: ${noResponseRatePercent}%`,
          `Follow-ups pendentes: ${pendingFollowups}`,
        ],
      },
      {
        title: "Subir negociações com maior intenção para etapa qualificada",
        reason: "Conversas com sinais de fechamento devem ganhar prioridade comercial.",
        confidence: closingIntent === "high" ? 0.87 : 0.73,
        suggestedLeadStatus: "qualified",
        suggestedOpportunityStage: "qualified",
        evidence: [
          `Intenção: ${closingIntent}`,
          `Classificações 24h: ${classificationsLast24h}`,
        ],
      },
    ],
  };
}

