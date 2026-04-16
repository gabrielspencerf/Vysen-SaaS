/**
 * Atualização de lead no dashboard. Garante tenant e normaliza email/telefone.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { leads } from "@/db/schema";
import {
  completeFollowupTasksForLead,
  ensureFollowupTaskForLead,
} from "@/server/followup/engine";
import { enqueueDueFollowupsForTenant } from "@/server/followup/enqueue-due-followups";
import { recordTenantActivity } from "@/server/tenancy/tenant-activity";

const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "converted",
  "lost",
  "duplicate",
  "bad_lead",
] as const;

function normalizeEmail(value: string | null | undefined): string | null {
  if (value == null || typeof value !== "string") return null;
  const t = value.trim();
  return t === "" ? null : t.toLowerCase();
}

function normalizePhone(value: string | null | undefined): string | null {
  if (value == null || typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return digits === "" ? null : digits;
}

export interface UpdateLeadInput {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: (typeof LEAD_STATUSES)[number];
  actorUserId?: string | null;
}

/**
 * Atualiza campos editáveis do lead, desde que pertença ao tenant.
 * Retorna true se atualizou, false se lead não existir ou não for do tenant.
 */
export async function updateLeadForTenant(
  tenantId: string,
  leadId: string,
  input: UpdateLeadInput
): Promise<{ ok: true } | { ok: false; error: "not_found" | "conflict" }> {
  const db = getDb();

  const [existing] = await db
    .select({
      id: leads.id,
      status: leads.status,
      funnelId: leads.funnelId,
      name: leads.name,
      email: leads.email,
    })
    .from(leads)
    .where(and(eq(leads.tenantId, tenantId), eq(leads.id, leadId)))
    .limit(1);

  if (!existing) return { ok: false, error: "not_found" };

  const updates: Partial<{
    name: string | null;
    email: string | null;
    phone: string | null;
    normalizedEmail: string | null;
    normalizedPhone: string | null;
    status: (typeof LEAD_STATUSES)[number];
  }> = {};

  if (input.name !== undefined) {
    updates.name = input.name?.trim() || null;
  }
  if (input.email !== undefined) {
    const normalized = normalizeEmail(input.email);
    updates.email = normalized ?? null;
    updates.normalizedEmail = normalized;
  }
  if (input.phone !== undefined) {
    const normalized = normalizePhone(input.phone);
    updates.phone = normalized ?? null;
    updates.normalizedPhone = normalized;
  }
  if (
    input.status !== undefined &&
    LEAD_STATUSES.includes(input.status as (typeof LEAD_STATUSES)[number])
  ) {
    updates.status = input.status;
  }

  if (Object.keys(updates).length === 0) return { ok: true };

  try {
    await db
      .update(leads)
      .set(updates)
      .where(and(eq(leads.tenantId, tenantId), eq(leads.id, leadId)));

    await recordTenantActivity({
      tenantId,
      actorUserId: input.actorUserId ?? null,
      scope: "products_leads",
      action: "update",
      notificationType: "lead_updated",
      title: "Lead atualizado",
      message: `Lead ${existing.name ?? existing.email ?? leadId} foi atualizado.`,
      resourceType: "lead",
      resourceId: leadId,
      oldValues: {
        status: existing.status,
      },
      newValues: updates,
      metadata: {
        leadId,
      },
    });

    if (updates.status && updates.status !== existing.status) {
      await recordTenantActivity({
        tenantId,
        actorUserId: input.actorUserId ?? null,
        scope: "products_leads",
        action: "update",
        notificationType: "lead_status_changed",
        title: "Status de lead atualizado",
        message: `Lead ${existing.name ?? existing.email ?? leadId} mudou de ${existing.status} para ${updates.status}.`,
        resourceType: "lead",
        resourceId: leadId,
        oldValues: { status: existing.status },
        newValues: { status: updates.status },
        metadata: {
          oldStatus: existing.status,
          newStatus: updates.status,
        },
      });
      if (
        updates.status === "converted" ||
        updates.status === "lost" ||
        updates.status === "duplicate" ||
        updates.status === "bad_lead"
      ) {
        await completeFollowupTasksForLead(tenantId, leadId, "completed");
      } else {
        await ensureFollowupTaskForLead({
          tenantId,
          leadId,
          funnelId: existing.funnelId,
          reason: "status_changed",
          currentStatus: updates.status,
        });
      }
    }

    await enqueueDueFollowupsForTenant(tenantId);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { ok: false, error: "conflict" };
    }
    throw err;
  }
}
