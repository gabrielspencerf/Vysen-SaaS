/**
 * Resumo analítico por tenant: totais operacionais + métricas Ads no período + top campanhas.
 * Usa apenas dados já persistidos; sem chamadas a APIs externas.
 */

import { eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  leads,
  conversations,
  googleAdsAccounts,
} from "@/db/schema";
import { listLeadsForTenant } from "./leads";
import { listConversationsForTenant } from "./conversations";
import type { LeadRow } from "./leads";
import type { ConversationRow } from "./conversations";

const RECENT_LEADS_LIMIT = 10;
const RECENT_CONVERSATIONS_LIMIT = 10;
const TOP_CAMPAIGNS_LIMIT = 15;
const DEFAULT_PERIOD_DAYS = 30;
const MIN_PERIOD_DAYS = 1;
const MAX_PERIOD_DAYS = 365;

export interface AnalyticsAdsPeriodTotals {
  spend: number;
  clicks: number;
  impressions: number;
}

export interface AnalyticsTopCampaignRow {
  accountExternalId: string;
  campaignName: string;
  externalCampaignId: string;
  spend: number;
  clicks: number;
  impressions: number;
}

export interface AnalyticsSummaryOptions {
  periodDays?: number;
}

/** Um dia na série "leads por dia" (últimos 7 dias). */
export interface LeadsByDayRow {
  name: string;
  leads: number;
  date: string;
}

/** Um dia no calendário mensal da home (mês atual). */
export interface CalendarLeadsByDayRow {
  date: string;
  leads: number;
}

/** Uma semana na série "gasto em ads" (últimas 4 semanas). */
export interface AdsSpendByWeekRow {
  name: string;
  gasto: number;
  cliques: number;
}

export interface LeadsByAccountRow {
  provider: string;
  accountDisplay: string;
  totalLeads: number;
}

export interface ConversationsByAccountRow {
  provider: string;
  accountDisplay: string;
  totalConversations: number;
}

export interface AnalyticsSummary {
  totalLeads: number;
  totalConversations: number;
  totalGoogleAdsAccounts: number;
  periodDays: number;
  adsPeriodTotals: AnalyticsAdsPeriodTotals;
  topCampaignsBySpend: AnalyticsTopCampaignRow[];
  recentLeads: LeadRow[];
  recentConversations: ConversationRow[];
  /** Leads por dia (últimos 7 dias) para o gráfico da home. */
  leadsByDay: LeadsByDayRow[];
  /** Leads por dia do mês atual para o calendário da home. */
  calendarLeadsByDay: CalendarLeadsByDayRow[];
  /** Gasto por semana (últimas 4 semanas) para o gráfico da home. */
  adsSpendByWeek: AdsSpendByWeekRow[];
  /** Totais de leads agrupados por conta/origem de integração. */
  leadsByAccount: LeadsByAccountRow[];
  /** Totais de conversas agrupados por conta (Evolution/UAZAPI). */
  conversationsByAccount: ConversationsByAccountRow[];
}

function clampPeriodDays(days: number): number {
  return Math.min(MAX_PERIOD_DAYS, Math.max(MIN_PERIOD_DAYS, Math.floor(days)));
}

/**
 * Totais de gasto, cliques e impressões nos campaign_snapshots do tenant no período (period_start >= today - periodDays).
 */
async function getAdsPeriodTotals(
  tenantId: string,
  periodDays: number
): Promise<AnalyticsAdsPeriodTotals> {
  const db = getDb();
  const days = clampPeriodDays(periodDays);
  const result = await db.execute<{
    spend: string;
    clicks: string;
    impressions: string;
  }>(sql`
    SELECT
      coalesce(sum(
        coalesce((metrics->>'cost')::numeric, (metrics->>'costMicros')::numeric / 1000000, 0)
      ), 0)::text AS spend,
      coalesce(sum(coalesce((metrics->>'clicks')::bigint, 0)), 0)::text AS clicks,
      coalesce(sum(coalesce((metrics->>'impressions')::bigint, 0)), 0)::text AS impressions
    FROM campaign_snapshots
    WHERE tenant_id = ${tenantId}
      AND period_start >= current_date - (${days} * interval '1 day')
  `);

  const rows = Array.isArray(result) ? result : (result as { rows?: typeof result }).rows ?? [];
  const row = rows[0];
  if (!row) {
    return { spend: 0, clicks: 0, impressions: 0 };
  }
  return {
    spend: Number(row.spend),
    clicks: Number(row.clicks),
    impressions: Number(row.impressions),
  };
}

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

/**
 * Contagem de novos leads por dia (últimos 7 dias). Usado no gráfico da home.
 */
async function getLeadsByDayLast7(tenantId: string): Promise<AnalyticsSummary["leadsByDay"]> {
  const db = getDb();
  const result = await db.execute<{ d: string; c: string }>(sql`
    SELECT (first_seen_at AT TIME ZONE 'UTC')::date AS d, count(*)::text AS c
    FROM leads
    WHERE tenant_id = ${tenantId}
      AND first_seen_at >= current_date - interval '7 days'
    GROUP BY (first_seen_at AT TIME ZONE 'UTC')::date
    ORDER BY d
  `);
  const rows = Array.isArray(result) ? result : (result as { rows?: typeof result }).rows ?? [];
  const byDate = new Map<string, number>();
  for (const r of rows) byDate.set(r.d, Number(r.c));

  const out: AnalyticsSummary["leadsByDay"] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayName = DAY_NAMES[d.getUTCDay()];
    out.push({ name: dayName, leads: byDate.get(dateStr) ?? 0, date: dateStr });
  }
  return out;
}

/**
 * Contagem de novos leads por dia no mês atual (UTC).
 * Mantém dias sem registros com zero para facilitar renderização do calendário.
 */
async function getCalendarLeadsByDayCurrentMonth(
  tenantId: string
): Promise<AnalyticsSummary["calendarLeadsByDay"]> {
  const db = getDb();
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const monthStart = new Date(Date.UTC(year, month, 1));
  const nextMonthStart = new Date(Date.UTC(year, month + 1, 1));

  const result = await db.execute<{ d: string; c: string }>(sql`
    SELECT (first_seen_at AT TIME ZONE 'UTC')::date AS d, count(*)::text AS c
    FROM leads
    WHERE tenant_id = ${tenantId}
      AND first_seen_at >= ${monthStart.toISOString()}
      AND first_seen_at < ${nextMonthStart.toISOString()}
    GROUP BY (first_seen_at AT TIME ZONE 'UTC')::date
    ORDER BY d
  `);
  const rows = Array.isArray(result) ? result : (result as { rows?: typeof result }).rows ?? [];
  const byDate = new Map<string, number>();
  for (const r of rows) byDate.set(r.d, Number(r.c));

  const out: AnalyticsSummary["calendarLeadsByDay"] = [];
  for (
    const d = new Date(monthStart);
    d < nextMonthStart;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const dateStr = d.toISOString().slice(0, 10);
    out.push({ date: dateStr, leads: byDate.get(dateStr) ?? 0 });
  }
  return out;
}

/**
 * Gasto em ads por semana (últimas 4 semanas). Usado no gráfico da home.
 */
async function getAdsSpendByWeekLast4(tenantId: string): Promise<AnalyticsSummary["adsSpendByWeek"]> {
  const db = getDb();
  const result = await db.execute<{ week_start: string; spend: string; clicks: string }>(sql`
    SELECT
      date_trunc('week', period_start)::date AS week_start,
      sum(coalesce((metrics->>'cost')::numeric, (metrics->>'costMicros')::numeric / 1000000, 0))::text AS spend,
      sum(coalesce((metrics->>'clicks')::bigint, 0))::text AS clicks
    FROM campaign_snapshots
    WHERE tenant_id = ${tenantId}
      AND period_start >= current_date - interval '28 days'
    GROUP BY date_trunc('week', period_start)::date
    ORDER BY week_start
    LIMIT 4
  `);
  const rows = Array.isArray(result) ? result : (result as { rows?: typeof result }).rows ?? [];
  const out: AnalyticsSummary["adsSpendByWeek"] = [
    { name: "Semana 1", gasto: 0, cliques: 0 },
    { name: "Semana 2", gasto: 0, cliques: 0 },
    { name: "Semana 3", gasto: 0, cliques: 0 },
    { name: "Semana 4", gasto: 0, cliques: 0 },
  ];
  rows.slice(0, 4).forEach((r, i) => {
    out[i] = { name: `Semana ${i + 1}`, gasto: Number(r.spend), cliques: Number(r.clicks) };
  });
  return out;
}

/**
 * Total de leads por conta/origem.
 * Usa integrations.name quando source_integration_id estiver disponível.
 */
async function getLeadsByAccount(tenantId: string): Promise<AnalyticsSummary["leadsByAccount"]> {
  const db = getDb();
  const result = await db.execute<{
    provider: string;
    account_display: string;
    total_leads: string;
  }>(sql`
    SELECT
      coalesce(i.provider::text, l.source_provider::text, 'manual') AS provider,
      coalesce(i.name, l.source_provider::text, 'Sem origem') AS account_display,
      count(*)::text AS total_leads
    FROM leads l
    LEFT JOIN integrations i
      ON i.id = l.source_integration_id
    WHERE l.tenant_id = ${tenantId}
    GROUP BY 1, 2
    ORDER BY count(*) DESC, 2 ASC
    LIMIT 12
  `);
  const rows = Array.isArray(result) ? result : (result as { rows?: typeof result }).rows ?? [];
  return rows.map((r) => ({
    provider: r.provider,
    accountDisplay: r.account_display,
    totalLeads: Number(r.total_leads),
  }));
}

/**
 * Total de conversas por conta de mensageria (Evolution/UAZAPI).
 */
async function getConversationsByAccount(
  tenantId: string
): Promise<AnalyticsSummary["conversationsByAccount"]> {
  const db = getDb();
  const result = await db.execute<{
    provider: string;
    account_display: string;
    total_conversations: string;
  }>(sql`
    SELECT
      CASE
        WHEN c.evolution_instance_id IS NOT NULL THEN 'evolution'
        WHEN c.uazapi_instance_id IS NOT NULL THEN 'uazapi'
        ELSE 'unknown'
      END AS provider,
      CASE
        WHEN c.evolution_instance_id IS NOT NULL THEN coalesce(ei.instance_name, ei.external_id, 'Evolution sem nome')
        WHEN c.uazapi_instance_id IS NOT NULL THEN coalesce(ui.instance_name, ui.external_id, 'UAZAPI sem nome')
        ELSE 'Sem conta'
      END AS account_display,
      count(*)::text AS total_conversations
    FROM conversations c
    LEFT JOIN evolution_instances ei ON ei.id = c.evolution_instance_id
    LEFT JOIN uazapi_instances ui ON ui.id = c.uazapi_instance_id
    WHERE c.tenant_id = ${tenantId}
    GROUP BY 1, 2
    ORDER BY count(*) DESC, 2 ASC
    LIMIT 12
  `);

  const rows = Array.isArray(result) ? result : (result as { rows?: typeof result }).rows ?? [];
  return rows.map((r) => ({
    provider: r.provider,
    accountDisplay: r.account_display,
    totalConversations: Number(r.total_conversations),
  }));
}

/**
 * Campanhas com maior gasto no período (agregado por conta + campanha).
 */
async function getTopCampaignsBySpend(
  tenantId: string,
  periodDays: number
): Promise<AnalyticsTopCampaignRow[]> {
  const db = getDb();
  const days = clampPeriodDays(periodDays);
  const result = await db.execute<{
    account_external_id: string;
    campaign_name: string;
    external_campaign_id: string;
    spend: string;
    clicks: string;
    impressions: string;
  }>(sql`
    SELECT
      ga.external_id AS account_external_id,
      cs.campaign_name,
      cs.external_campaign_id,
      sum(coalesce((cs.metrics->>'cost')::numeric, (cs.metrics->>'costMicros')::numeric / 1000000, 0))::text AS spend,
      sum(coalesce((cs.metrics->>'clicks')::bigint, 0))::text AS clicks,
      sum(coalesce((cs.metrics->>'impressions')::bigint, 0))::text AS impressions
    FROM campaign_snapshots cs
    INNER JOIN google_ads_accounts ga ON cs.google_ads_account_id = ga.id
    WHERE cs.tenant_id = ${tenantId}
      AND cs.period_start >= current_date - (${days} * interval '1 day')
    GROUP BY ga.external_id, cs.campaign_name, cs.external_campaign_id, cs.google_ads_account_id
    ORDER BY sum(coalesce((cs.metrics->>'cost')::numeric, (cs.metrics->>'costMicros')::numeric / 1000000, 0)) DESC
    LIMIT ${TOP_CAMPAIGNS_LIMIT}
  `);

  const rows = Array.isArray(result) ? result : (result as { rows?: typeof result }).rows ?? [];
  return rows.map((r) => ({
    accountExternalId: r.account_external_id,
    campaignName: r.campaign_name,
    externalCampaignId: r.external_campaign_id,
    spend: Number(r.spend),
    clicks: Number(r.clicks),
    impressions: Number(r.impressions),
  }));
}

/**
 * Resumo analítico completo: totais gerais, métricas Ads no período, top campanhas e listas recentes.
 * Tudo tenant-scoped; período aplicado apenas aos dados de Ads.
 */
export async function getAnalyticsSummaryForTenant(
  tenantId: string,
  options: AnalyticsSummaryOptions = {}
): Promise<AnalyticsSummary> {
  const periodDays = clampPeriodDays(options.periodDays ?? DEFAULT_PERIOD_DAYS);
  const db = getDb();

  const [
    totalLeadsResult,
    totalConvsResult,
    totalAccountsResult,
    adsTotals,
    topCampaigns,
    recentLeads,
    recentConversations,
    leadsByDay,
    calendarLeadsByDay,
    adsSpendByWeek,
    leadsByAccount,
    conversationsByAccount,
  ] = await Promise.all([
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(leads)
      .where(eq(leads.tenantId, tenantId)),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(conversations)
      .where(eq(conversations.tenantId, tenantId)),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(googleAdsAccounts)
      .where(eq(googleAdsAccounts.tenantId, tenantId)),
    getAdsPeriodTotals(tenantId, periodDays),
    getTopCampaignsBySpend(tenantId, periodDays),
    listLeadsForTenant(tenantId, { limit: RECENT_LEADS_LIMIT }),
    listConversationsForTenant(tenantId, { limit: RECENT_CONVERSATIONS_LIMIT }),
    getLeadsByDayLast7(tenantId),
    getCalendarLeadsByDayCurrentMonth(tenantId),
    getAdsSpendByWeekLast4(tenantId),
    getLeadsByAccount(tenantId),
    getConversationsByAccount(tenantId),
  ]);

  const totalLeads = totalLeadsResult[0]?.value ?? 0;
  const totalConversations = totalConvsResult[0]?.value ?? 0;
  const totalGoogleAdsAccounts = totalAccountsResult[0]?.value ?? 0;

  return {
    totalLeads,
    totalConversations,
    totalGoogleAdsAccounts,
    periodDays,
    adsPeriodTotals: adsTotals,
    topCampaignsBySpend: topCampaigns,
    recentLeads,
    recentConversations,
    leadsByDay,
    calendarLeadsByDay,
    adsSpendByWeek,
    leadsByAccount,
    conversationsByAccount,
  };
}
