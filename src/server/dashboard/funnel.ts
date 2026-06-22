/**
 * Visão de funil por tenant: volume por etapa, conversão, % do total e gargalo.
 * Usa leads.funnel_id, leads.current_funnel_step_id e funnel_steps.
 */

import { eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { funnels, funnelSteps } from "@/db/schema";

export interface FunnelStepVolume {
  stepId: string;
  stepName: string;
  sortOrder: number;
  leadCount: number;
  /** Taxa de conversão em relação à etapa anterior (0–100). Nulo na primeira etapa. */
  conversionFromPrevious: number | null;
  /** Percentual do total do funil (etapas + sem etapa). */
  percentOfTotal: number;
}

export interface FunnelOverviewRow {
  funnelId: string;
  funnelName: string;
  isActive: boolean;
  steps: FunnelStepVolume[];
  /** Leads no funil sem etapa atribuída (current_funnel_step_id null). */
  unassignedCount: number;
  /** Percentual "sem etapa" em relação ao total. */
  unassignedPercentOfTotal: number;
  /** Total de leads no funil (por etapa + sem etapa). */
  totalLeads: number;
  /** Índice da etapa a partir da qual a conversão para a próxima é a pior (gargalo). null se &lt; 2 etapas. */
  bottleneckFromStepIndex: number | null;
}

export interface FunnelOverviewOptions {
  /** Se definido, considera apenas leads com first_seen_at no último N dias. */
  periodDays?: number;
}

const MAX_PERIOD_DAYS = 365;

function clampPeriodDays(days: number): number {
  if (days < 1) return 1;
  return days > MAX_PERIOD_DAYS ? MAX_PERIOD_DAYS : Math.floor(days);
}

/**
 * Retorna funis do tenant com etapas ordenadas, contagem, conversão, % do total e gargalo.
 * Opcionalmente filtra leads por first_seen_at (últimos N dias).
 */
export async function getFunnelOverviewForTenant(
  tenantId: string,
  options: FunnelOverviewOptions = {}
): Promise<FunnelOverviewRow[]> {
  const db = getDb();
  const periodDays = options.periodDays != null ? clampPeriodDays(options.periodDays) : null;

  const countQuery =
    periodDays == null
      ? sql`
          SELECT
            funnel_id,
            current_funnel_step_id,
            count(*)::text AS lead_count
          FROM leads
          WHERE tenant_id = ${tenantId}
            AND funnel_id IS NOT NULL
          GROUP BY funnel_id, current_funnel_step_id
        `
      : sql`
          SELECT
            funnel_id,
            current_funnel_step_id,
            count(*)::text AS lead_count
          FROM leads
          WHERE tenant_id = ${tenantId}
            AND funnel_id IS NOT NULL
            AND first_seen_at >= (current_date - (${periodDays} * interval '1 day'))::timestamp
            AND first_seen_at < (current_date + interval '1 day')::timestamp
          GROUP BY funnel_id, current_funnel_step_id
        `;

  const [funnelRows, stepRows, countRows] = await Promise.all([
    db
      .select({
        id: funnels.id,
        name: funnels.name,
        isActive: funnels.isActive,
      })
      .from(funnels)
      .where(eq(funnels.tenantId, tenantId))
      .orderBy(funnels.name),
    db
      .select({
        id: funnelSteps.id,
        funnelId: funnelSteps.funnelId,
        name: funnelSteps.name,
        sortOrder: funnelSteps.sortOrder,
      })
      .from(funnelSteps)
      .where(eq(funnelSteps.tenantId, tenantId))
      .orderBy(funnelSteps.funnelId, funnelSteps.sortOrder),
    db.execute<{
      funnel_id: string;
      current_funnel_step_id: string | null;
      lead_count: string;
    }>(countQuery),
  ]);

  const countResult =
    Array.isArray(countRows) ? countRows : (countRows as { rows?: typeof countRows }).rows ?? [];
  const countByKey = new Map<string, number>();
  const unassignedByFunnel = new Map<string, number>();
  for (const r of countResult) {
    const key = `${r.funnel_id}:${r.current_funnel_step_id ?? "null"}`;
    const n = Number(r.lead_count);
    countByKey.set(key, n);
    if (r.current_funnel_step_id == null) {
      unassignedByFunnel.set(r.funnel_id, n);
    }
  }

  const stepsByFunnel = new Map<string, { id: string; name: string; sortOrder: number }[]>();
  for (const s of stepRows) {
    const list = stepsByFunnel.get(s.funnelId) ?? [];
    list.push({ id: s.id, name: s.name, sortOrder: s.sortOrder });
    stepsByFunnel.set(s.funnelId, list);
  }

  const out: FunnelOverviewRow[] = [];
  for (const f of funnelRows) {
    const steps = stepsByFunnel.get(f.id) ?? [];
    const unassignedCount = unassignedByFunnel.get(f.id) ?? 0;
    const stepVolumes: FunnelStepVolume[] = steps.map((s) => ({
      stepId: s.id,
      stepName: s.name,
      sortOrder: s.sortOrder,
      leadCount: countByKey.get(`${f.id}:${s.id}`) ?? 0,
      conversionFromPrevious: null,
      percentOfTotal: 0,
    }));
    const totalInSteps = stepVolumes.reduce((sum, s) => sum + s.leadCount, 0);
    const totalLeads = totalInSteps + unassignedCount;

    if (totalLeads > 0) {
      for (let i = 0; i < stepVolumes.length; i++) {
        stepVolumes[i].percentOfTotal = (stepVolumes[i].leadCount / totalLeads) * 100;
        const prevCount = i === 0 ? null : stepVolumes[i - 1].leadCount;
        stepVolumes[i].conversionFromPrevious =
          prevCount != null && prevCount > 0
            ? (stepVolumes[i].leadCount / prevCount) * 100
            : null;
      }
    }
    const unassignedPercentOfTotal =
      totalLeads > 0 ? (unassignedCount / totalLeads) * 100 : 0;

    let bottleneckFromStepIndex: number | null = null;
    if (stepVolumes.length >= 2) {
      let minConversion = 101;
      for (let i = 0; i < stepVolumes.length - 1; i++) {
        const conversionToNext = stepVolumes[i + 1].conversionFromPrevious;
        if (
          conversionToNext != null &&
          conversionToNext < minConversion
        ) {
          minConversion = conversionToNext;
          bottleneckFromStepIndex = i;
        }
      }
    }

    out.push({
      funnelId: f.id,
      funnelName: f.name,
      isActive: f.isActive,
      steps: stepVolumes,
      unassignedCount,
      unassignedPercentOfTotal,
      totalLeads,
      bottleneckFromStepIndex,
    });
  }

  return out;
}
