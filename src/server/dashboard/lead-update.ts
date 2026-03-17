/**
 * Atualização de lead no dashboard. Garante tenant e normaliza email/telefone.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { leads } from "@/db/schema";

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
    .select({ id: leads.id })
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
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { ok: false, error: "conflict" };
    }
    throw err;
  }
}
