/**
 * Oportunidades: listagem, detalhe e atualização (incl. contact_started_at, contracted_model, job_value).
 */

import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { aiClassifications, opportunities } from "@/db/schema";
import {
  extractAiInsightFromEvidences,
  type ConversationAiInsight,
} from "@/server/ai/commercial-agent";
import { writeAuditLog } from "@/server/audit/log";

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
  aiInsight: ConversationAiInsight | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateOpportunityInput {
  stage?: string;
  title?: string | null;
  contactStartedAt?: string | null; // ISO date
  contractedModel?: string | null;
  jobValue?: string | null; // decimal string
  actorUserId?: string | null;
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
    aiInsight: null,
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
  const [classification] =
    row.conversationId
      ? await db
          .select({
            summary: aiClassifications.summary,
            classificationType: aiClassifications.classificationType,
            confidenceScore: aiClassifications.confidenceScore,
            evidences: aiClassifications.evidences,
          })
          .from(aiClassifications)
          .where(
            and(
              eq(aiClassifications.tenantId, tenantId),
              eq(aiClassifications.conversationId, row.conversationId),
              eq(aiClassifications.isCurrent, true)
            )
          )
          .orderBy(desc(aiClassifications.processedAt))
          .limit(1)
      : [null];
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
    aiInsight: classification
      ? extractAiInsightFromEvidences({
          summary: classification.summary,
          classificationType: classification.classificationType,
          confidenceScore: classification.confidenceScore,
          evidences: (classification.evidences as Record<string, unknown> | null) ?? null,
        })
      : null,
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
    .select({ id: opportunities.id, stage: opportunities.stage })
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
  await writeAuditLog({
    tenantId,
    userId: input.actorUserId ?? null,
    action: "update",
    resourceType: "opportunity",
    resourceId: opportunityId,
    oldValues: { stage: existing.stage },
    newValues: updates,
  });
  return { ok: true };
}

export interface CreateOpportunityInput {
  stage?: string;
  title?: string | null;
  contactStartedAt?: string | null;
  contractedModel?: string | null;
  jobValue?: string | null;
  leadId?: string | null;
  contactId?: string | null;
  conversationId?: string | null;
  actorUserId?: string | null;
}

export async function createOpportunityForTenant(
  tenantId: string,
  input: CreateOpportunityInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const db = getDb();
  const [inserted] = await db
    .insert(opportunities)
    .values({
      tenantId,
      stage: (input.stage ?? "open") as never,
      title: input.title ?? null,
      contactStartedAt: input.contactStartedAt
        ? new Date(input.contactStartedAt)
        : null,
      contractedModel: input.contractedModel ?? null,
      jobValue: input.jobValue ?? null,
      leadId: input.leadId ?? null,
      contactId: input.contactId ?? null,
      conversationId: input.conversationId ?? null,
    })
    .returning({ id: opportunities.id });
  if (!inserted) return { ok: false, error: "Falha ao criar oportunidade" };
  await writeAuditLog({
    tenantId,
    userId: input.actorUserId ?? null,
    action: "create",
    resourceType: "opportunity",
    resourceId: inserted.id,
    newValues: {
      stage: input.stage ?? "open",
      title: input.title ?? null,
      leadId: input.leadId ?? null,
    },
  });
  return { ok: true, id: inserted.id };
}

export async function deleteOpportunityForTenant(
  tenantId: string,
  opportunityId: string,
  actorUserId: string | null
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
  await db
    .delete(opportunities)
    .where(
      and(
        eq(opportunities.tenantId, tenantId),
        eq(opportunities.id, opportunityId)
      )
    );
  await writeAuditLog({
    tenantId,
    userId: actorUserId,
    action: "delete",
    resourceType: "opportunity",
    resourceId: opportunityId,
  });
  return { ok: true };
}
