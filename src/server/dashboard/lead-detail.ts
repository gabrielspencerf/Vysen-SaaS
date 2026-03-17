/**
 * Detalhe de lead por tenant. Retorna null se o lead não existir ou não pertencer ao tenant.
 */

import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  leads,
  leadEvents,
  funnelSteps,
  funnels,
  utmAttributions,
  conversations,
  evolutionInstances,
  uazapiInstances,
} from "@/db/schema";

export interface LeadDetailUtm {
  id: string;
  touchType: string;
  touchSequence: number;
  touchedAt: Date;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
}

export interface LeadDetailEvent {
  id: string;
  eventType: string;
  occurredAt: Date;
  payload: Record<string, unknown> | null;
  /** Nome da etapa do funil associada ao evento, quando houver funnel_step_id. */
  stepName: string | null;
}

export interface LeadDetailConversation {
  id: string;
  externalId: string;
  status: string;
  startedAt: Date;
  instanceDisplay: string;
}

export interface LeadDetail {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  sourceProvider: string | null;
  sourceExternalId: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  /** Funil do lead (quando atribuído). */
  funnelId: string | null;
  funnelName: string | null;
  /** Etapa atual do funil. */
  currentFunnelStepId: string | null;
  currentStepName: string | null;
  utmAttributions: LeadDetailUtm[];
  events: LeadDetailEvent[];
  conversations: LeadDetailConversation[];
}

/**
 * Carrega lead pelo id garantindo tenant_id. Retorna null se não existir ou não for do tenant.
 */
export async function getLeadDetailForTenant(
  tenantId: string,
  leadId: string
): Promise<LeadDetail | null> {
  const db = getDb();

  const [lead] = await db
    .select({
      id: leads.id,
      name: leads.name,
      email: leads.email,
      phone: leads.phone,
      status: leads.status,
      sourceProvider: leads.sourceProvider,
      sourceExternalId: leads.sourceExternalId,
      firstSeenAt: leads.firstSeenAt,
      lastSeenAt: leads.lastSeenAt,
      funnelId: leads.funnelId,
      currentFunnelStepId: leads.currentFunnelStepId,
      funnelName: funnels.name,
      currentStepName: funnelSteps.name,
    })
    .from(leads)
    .leftJoin(funnels, eq(leads.funnelId, funnels.id))
    .leftJoin(funnelSteps, eq(leads.currentFunnelStepId, funnelSteps.id))
    .where(and(eq(leads.tenantId, tenantId), eq(leads.id, leadId)))
    .limit(1);

  if (!lead) return null;

  const [utmRows, eventRows, convRows] = await Promise.all([
    db
      .select({
        id: utmAttributions.id,
        touchType: utmAttributions.touchType,
        touchSequence: utmAttributions.touchSequence,
        touchedAt: utmAttributions.touchedAt,
        utmSource: utmAttributions.utmSource,
        utmMedium: utmAttributions.utmMedium,
        utmCampaign: utmAttributions.utmCampaign,
        utmTerm: utmAttributions.utmTerm,
        utmContent: utmAttributions.utmContent,
      })
      .from(utmAttributions)
      .where(eq(utmAttributions.leadId, leadId))
      .orderBy(asc(utmAttributions.touchSequence)),
    db
      .select({
        id: leadEvents.id,
        eventType: leadEvents.eventType,
        occurredAt: leadEvents.occurredAt,
        payload: leadEvents.payload,
        stepName: funnelSteps.name,
      })
      .from(leadEvents)
      .leftJoin(funnelSteps, eq(leadEvents.funnelStepId, funnelSteps.id))
      .where(eq(leadEvents.leadId, leadId))
      .orderBy(asc(leadEvents.occurredAt)),
    db
      .select({
        id: conversations.id,
        externalId: conversations.externalId,
        status: conversations.status,
        startedAt: conversations.startedAt,
        evolutionInstanceName: evolutionInstances.instanceName,
        evolutionInstanceExternalId: evolutionInstances.externalId,
        uazapiInstanceName: uazapiInstances.instanceName,
        uazapiInstanceExternalId: uazapiInstances.externalId,
      })
      .from(conversations)
      .leftJoin(
        evolutionInstances,
        eq(conversations.evolutionInstanceId, evolutionInstances.id)
      )
      .leftJoin(
        uazapiInstances,
        eq(conversations.uazapiInstanceId, uazapiInstances.id)
      )
      .where(
        and(
          eq(conversations.tenantId, tenantId),
          eq(conversations.leadId, leadId)
        )
      )
      .orderBy(desc(conversations.startedAt)),
  ]);

  return {
    ...lead,
    utmAttributions: utmRows.map((r) => ({
      id: r.id,
      touchType: r.touchType,
      touchSequence: r.touchSequence,
      touchedAt: r.touchedAt,
      utmSource: r.utmSource,
      utmMedium: r.utmMedium,
      utmCampaign: r.utmCampaign,
      utmTerm: r.utmTerm,
      utmContent: r.utmContent,
    })),
    events: eventRows.map((r) => ({
      id: r.id,
      eventType: r.eventType,
      occurredAt: r.occurredAt,
      payload: r.payload as Record<string, unknown> | null,
      stepName: r.stepName ?? null,
    })),
    conversations: convRows.map((r) => {
      const evolutionDisplay =
        (r.evolutionInstanceName && r.evolutionInstanceName.trim()) ||
        r.evolutionInstanceExternalId ||
        "";
      const uazapiDisplay =
        (r.uazapiInstanceName && r.uazapiInstanceName.trim()) ||
        r.uazapiInstanceExternalId ||
        "";
      return {
        id: r.id,
        externalId: r.externalId,
        status: r.status,
        startedAt: r.startedAt,
        instanceDisplay: evolutionDisplay || uazapiDisplay || r.id,
      };
    }),
  };
}
