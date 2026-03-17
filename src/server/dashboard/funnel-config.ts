/**
 * CRUD de funis e etapas para configuração pelo perfil do cliente (tenant).
 * Funil padrão do tenant em tenants.settings.default_funnel_id.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { funnels, funnelSteps, tenants } from "@/db/schema";

const DEFAULT_FUNNEL_KEY = "default_funnel_id";

export interface FunnelRow {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FunnelStepRow {
  id: string;
  funnelId: string;
  name: string;
  sortOrder: number;
  criteria: Record<string, unknown> | null;
}

export interface FunnelWithStepsRow extends FunnelRow {
  steps: FunnelStepRow[];
}

export interface CreateFunnelInput {
  name: string;
  description?: string | null;
  isActive?: boolean;
}

export interface UpdateFunnelInput {
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface CreateFunnelStepInput {
  name: string;
  /** Opcional; se omitido, usa max(sortOrder)+1 no funil. */
  sortOrder?: number;
  criteria?: Record<string, unknown> | null;
}

export interface UpdateFunnelStepInput {
  name?: string;
  sortOrder?: number;
  criteria?: Record<string, unknown> | null;
}

export async function listFunnelsForTenant(
  tenantId: string
): Promise<FunnelRow[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(funnels)
    .where(eq(funnels.tenantId, tenantId))
    .orderBy(funnels.name);
  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    name: r.name,
    description: r.description,
    isActive: r.isActive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function getFunnelWithStepsForTenant(
  tenantId: string,
  funnelId: string
): Promise<FunnelWithStepsRow | null> {
  const db = getDb();
  const [funnel] = await db
    .select()
    .from(funnels)
    .where(and(eq(funnels.tenantId, tenantId), eq(funnels.id, funnelId)))
    .limit(1);
  if (!funnel) return null;

  const steps = await db
    .select({
      id: funnelSteps.id,
      funnelId: funnelSteps.funnelId,
      name: funnelSteps.name,
      sortOrder: funnelSteps.sortOrder,
      criteria: funnelSteps.criteria,
    })
    .from(funnelSteps)
    .where(eq(funnelSteps.funnelId, funnelId))
    .orderBy(funnelSteps.sortOrder);

  return {
    id: funnel.id,
    tenantId: funnel.tenantId,
    name: funnel.name,
    description: funnel.description,
    isActive: funnel.isActive,
    createdAt: funnel.createdAt,
    updatedAt: funnel.updatedAt,
    steps: steps.map((s) => ({
      id: s.id,
      funnelId: s.funnelId,
      name: s.name,
      sortOrder: s.sortOrder,
      criteria: s.criteria as Record<string, unknown> | null,
    })),
  };
}

export async function createFunnelForTenant(
  tenantId: string,
  input: CreateFunnelInput
): Promise<{ id: string } | { error: string }> {
  const name = input.name?.trim();
  if (!name) return { error: "Nome do funil é obrigatório" };
  if (name.length > 255) return { error: "Nome muito longo" };

  const db = getDb();
  const [row] = await db
    .insert(funnels)
    .values({
      tenantId,
      name,
      description: input.description?.trim() ?? null,
      isActive: input.isActive ?? true,
    })
    .returning({ id: funnels.id });
  if (!row) return { error: "Falha ao criar funil" };
  return { id: row.id };
}

export async function updateFunnelForTenant(
  tenantId: string,
  funnelId: string,
  input: UpdateFunnelInput
): Promise<{ ok: true } | { error: string }> {
  const existing = await getFunnelWithStepsForTenant(tenantId, funnelId);
  if (!existing) return { error: "Funil não encontrado" };

  const name = input.name !== undefined ? input.name.trim() : existing.name;
  if (!name) return { error: "Nome do funil é obrigatório" };
  if (name.length > 255) return { error: "Nome muito longo" };

  const db = getDb();
  await db
    .update(funnels)
    .set({
      name,
      description: input.description !== undefined ? input.description : existing.description,
      isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
      updatedAt: new Date(),
    })
    .where(and(eq(funnels.tenantId, tenantId), eq(funnels.id, funnelId)));
  return { ok: true };
}

export async function deleteFunnelForTenant(
  tenantId: string,
  funnelId: string
): Promise<{ ok: true } | { error: string }> {
  const existing = await getFunnelWithStepsForTenant(tenantId, funnelId);
  if (!existing) return { error: "Funil não encontrado" };

  const db = getDb();
  await db.delete(funnelSteps).where(eq(funnelSteps.funnelId, funnelId));
  await db
    .delete(funnels)
    .where(and(eq(funnels.tenantId, tenantId), eq(funnels.id, funnelId)));
  return { ok: true };
}

export async function createFunnelStepForTenant(
  tenantId: string,
  funnelId: string,
  input: CreateFunnelStepInput
): Promise<{ id: string } | { error: string }> {
  const funnel = await getFunnelWithStepsForTenant(tenantId, funnelId);
  if (!funnel) return { error: "Funil não encontrado" };

  const name = input.name?.trim();
  if (!name) return { error: "Nome da etapa é obrigatório" };
  if (name.length > 255) return { error: "Nome da etapa muito longo" };

  const maxOrder = funnel.steps.length > 0
    ? Math.max(...funnel.steps.map((s) => s.sortOrder))
    : -1;
  const sortOrder = input.sortOrder !== undefined
    ? Math.max(0, Math.floor(input.sortOrder))
    : maxOrder + 1;
  const db = getDb();
  const [row] = await db
    .insert(funnelSteps)
    .values({
      tenantId,
      funnelId,
      name,
      sortOrder,
      criteria: input.criteria ?? null,
    })
    .returning({ id: funnelSteps.id });
  if (!row) return { error: "Falha ao criar etapa" };
  return { id: row.id };
}

export async function updateFunnelStepForTenant(
  tenantId: string,
  funnelId: string,
  stepId: string,
  input: UpdateFunnelStepInput
): Promise<{ ok: true } | { error: string }> {
  const funnel = await getFunnelWithStepsForTenant(tenantId, funnelId);
  if (!funnel) return { error: "Funil não encontrado" };
  const step = funnel.steps.find((s) => s.id === stepId);
  if (!step) return { error: "Etapa não encontrada" };

  const name = input.name !== undefined ? input.name.trim() : step.name;
  if (name && name.length > 255) return { error: "Nome da etapa muito longo" };
  const sortOrder = input.sortOrder !== undefined ? Math.max(0, Math.floor(input.sortOrder)) : step.sortOrder;

  const db = getDb();
  await db
    .update(funnelSteps)
    .set({
      name: input.name !== undefined ? name : step.name,
      sortOrder,
      criteria: input.criteria !== undefined ? input.criteria : step.criteria,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(funnelSteps.tenantId, tenantId),
        eq(funnelSteps.funnelId, funnelId),
        eq(funnelSteps.id, stepId)
      )
    );
  return { ok: true };
}

export async function deleteFunnelStepForTenant(
  tenantId: string,
  funnelId: string,
  stepId: string
): Promise<{ ok: true } | { error: string }> {
  const funnel = await getFunnelWithStepsForTenant(tenantId, funnelId);
  if (!funnel) return { error: "Funil não encontrado" };
  if (!funnel.steps.some((s) => s.id === stepId)) return { error: "Etapa não encontrada" };

  const db = getDb();
  await db
    .delete(funnelSteps)
    .where(
      and(
        eq(funnelSteps.tenantId, tenantId),
        eq(funnelSteps.funnelId, funnelId),
        eq(funnelSteps.id, stepId)
      )
    );
  return { ok: true };
}

export async function getDefaultFunnelIdForTenant(
  tenantId: string
): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!row?.settings || typeof row.settings !== "object" || !(DEFAULT_FUNNEL_KEY in row.settings)) {
    return null;
  }
  const v = row.settings[DEFAULT_FUNNEL_KEY];
  return typeof v === "string" ? v : null;
}

export async function setDefaultFunnelIdForTenant(
  tenantId: string,
  funnelId: string | null
): Promise<{ ok: true } | { error: string }> {
  if (funnelId) {
    const funnel = await getFunnelWithStepsForTenant(tenantId, funnelId);
    if (!funnel) return { error: "Funil não encontrado" };
  }

  const db = getDb();
  const [row] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const current = (row?.settings && typeof row.settings === "object"
    ? { ...row.settings }
    : {}) as Record<string, unknown>;
  if (funnelId === null) {
    delete current[DEFAULT_FUNNEL_KEY];
  } else {
    current[DEFAULT_FUNNEL_KEY] = funnelId;
  }
  await db
    .update(tenants)
    .set({ settings: current, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));
  return { ok: true };
}
