/**
 * Oportunidades: listagem, detalhe e atualização (incl. contact_started_at, contracted_model, job_value).
 */

import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { opportunities } from "@/db/schema";

export interface OpportunityRow {
  id: string;
  tenantId: string;
  leadId: string | null;
  contactId: string | null;
  conversationId: string | null;
  stage: string;
  title: string | null;
  contactStartedAt: Date | null;
  contractedModel: string | null;
  jobValue: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateOpportunityInput {
  stage?: string;
  title?: string | null;
  contactStartedAt?: string | null; // ISO date
  contractedModel?: string | null;
  jobValue?: string | null; // decimal string
}

export async function listOpportunitiesForTenant(
  tenantId: string,
  options: { leadId?: string; contactId?: string; limit?: number } = {}
): Promise<OpportunityRow[]> {
  const db = getDb();
  const { leadId, contactId, limit = 100 } = options;
  const conditions = [eq(opportunities.tenantId, tenantId)];
  if (leadId) conditions.push(eq(opportunities.leadId, leadId));
  if (contactId) conditions.push(eq(opportunities.contactId, contactId));
  const rows = await db
    .select()
    .from(opportunities)
    .where(and(...conditions))
    .orderBy(desc(opportunities.updatedAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    leadId: r.leadId,
    contactId: r.contactId,
    conversationId: r.conversationId,
    stage: r.stage,
    title: r.title,
    contactStartedAt: r.contactStartedAt,
    contractedModel: r.contractedModel,
    jobValue: r.jobValue,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function getOpportunityForTenant(
  tenantId: string,
  opportunityId: string
): Promise<OpportunityRow | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(opportunities)
    .where(
      and(
        eq(opportunities.tenantId, tenantId),
        eq(opportunities.id, opportunityId)
      )
    )
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    leadId: row.leadId,
    contactId: row.contactId,
    conversationId: row.conversationId,
    stage: row.stage,
    title: row.title,
    contactStartedAt: row.contactStartedAt,
    contractedModel: row.contractedModel,
    jobValue: row.jobValue,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function updateOpportunityForTenant(
  tenantId: string,
  opportunityId: string,
  input: UpdateOpportunityInput
): Promise<{ ok: true } | { ok: false; error: "not_found" }> {
  const db = getDb();
  const [existing] = await db
    .select({ id: opportunities.id })
    .from(opportunities)
    .where(
      and(
        eq(opportunities.tenantId, tenantId),
        eq(opportunities.id, opportunityId)
      )
    )
    .limit(1);
  if (!existing) return { ok: false, error: "not_found" };

  const updates: Record<string, unknown> = {};
  if (input.stage !== undefined) updates.stage = input.stage;
  if (input.title !== undefined) updates.title = input.title ?? null;
  if (input.contactStartedAt !== undefined)
    updates.contactStartedAt = input.contactStartedAt
      ? new Date(input.contactStartedAt)
      : null;
  if (input.contractedModel !== undefined)
    updates.contractedModel = input.contractedModel ?? null;
  if (input.jobValue !== undefined) updates.jobValue = input.jobValue ?? null;

  if (Object.keys(updates).length === 0) return { ok: true };

  await db
    .update(opportunities)
    .set(updates as Partial<typeof opportunities.$inferInsert>)
    .where(
      and(
        eq(opportunities.tenantId, tenantId),
        eq(opportunities.id, opportunityId)
      )
    );
  return { ok: true };
}
