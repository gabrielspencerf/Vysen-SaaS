/**
 * CRUD de tenants (admin global). Não faz checagem de permissão — chamador deve usar requireAdmin.
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { tenants } from "@/db/schema";
import {
  mergeTenantFeatureFlagsInSettings,
  normalizeTenantFeatureFlags,
} from "@/server/tenancy/tenant-features";
import {
  encryptSecretForStorage,
  tryDecryptStoredSecret,
} from "@/server/security/secret-storage";

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  settings?: Record<string, unknown> | null;
}

export interface UpdateTenantInput {
  name?: string;
  slug?: string;
  isActive?: boolean;
  settings?: Record<string, unknown> | null;
}

function normalizeTenantSettingsInput(
  settings: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (settings === null) return null;
  const baseSettings: Record<string, unknown> = settings ? { ...settings } : {};

  // Encrypt per-tenant OpenAI API key before persisting.
  if (typeof baseSettings.openai_agent_api_key === "string") {
    const raw = baseSettings.openai_agent_api_key.trim();
    if (raw) {
      baseSettings.openai_agent_api_key = encryptSecretForStorage(
        raw,
        "openai-agent-api-key"
      );
    } else {
      delete baseSettings.openai_agent_api_key;
    }
  }

  const featureFlags = normalizeTenantFeatureFlags(baseSettings);
  return mergeTenantFeatureFlagsInSettings(baseSettings, featureFlags);
}

export function decryptTenantSettingsForResponse(
  settings: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!settings) return settings ?? null;
  const out: Record<string, unknown> = { ...settings };
  if (typeof out.openai_agent_api_key === "string") {
    const decrypted = tryDecryptStoredSecret(
      out.openai_agent_api_key,
      "openai-agent-api-key-response"
    );
    if (decrypted) out.openai_agent_api_key = decrypted;
    else delete out.openai_agent_api_key;
  }
  return out;
}

export async function listTenants(): Promise<TenantRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      settings: tenants.settings,
      isActive: tenants.isActive,
      createdAt: tenants.createdAt,
      updatedAt: tenants.updatedAt,
    })
    .from(tenants)
    .orderBy(tenants.name);
  return rows;
}

export async function getTenantById(id: string): Promise<TenantRow | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      settings: tenants.settings,
      isActive: tenants.isActive,
      createdAt: tenants.createdAt,
      updatedAt: tenants.updatedAt,
    })
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);
  return row ?? null;
}

export async function createTenant(
  input: CreateTenantInput
): Promise<{ id: string } | { error: string }> {
  const db = getDb();
  const name = input.name?.trim() ?? "";
  const slug = (input.slug?.trim() ?? "").toLowerCase().replace(/\s+/g, "-");
  const settings = normalizeTenantSettingsInput(input.settings);
  if (!name || !slug) {
    return { error: "Nome e slug são obrigatórios" };
  }
  if (slug.length > 64) {
    return { error: "Slug muito longo" };
  }
  try {
    const [inserted] = await db
      .insert(tenants)
      .values({
        name,
        slug,
        isActive: true,
        settings,
      })
      .returning({ id: tenants.id });
    if (!inserted) return { error: "Falha ao criar tenant" };
    return { id: inserted.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { error: "Já existe um tenant com este slug" };
    }
    return { error: "Erro ao criar tenant" };
  }
}

export async function updateTenant(
  id: string,
  input: UpdateTenantInput
): Promise<{ ok: true } | { error: string }> {
  const db = getDb();
  const existing = await getTenantById(id);
  if (!existing) return { error: "Tenant não encontrado" };

  const name = input.name !== undefined ? input.name.trim() : existing.name;
  const slug =
    input.slug !== undefined
      ? input.slug.toLowerCase().replace(/\s+/g, "-")
      : existing.slug;
  const isActive = input.isActive !== undefined ? input.isActive : existing.isActive;
  const settings = input.settings !== undefined ? input.settings : existing.settings;
  const normalizedSettings = normalizeTenantSettingsInput(settings);

  if (!name || !slug) return { error: "Nome e slug são obrigatórios" };
  if (slug.length > 64) return { error: "Slug muito longo" };

  try {
    await db
      .update(tenants)
      .set({
        name,
        slug,
        settings: normalizedSettings,
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id));
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { error: "Já existe um tenant com este slug" };
    }
    return { error: "Erro ao atualizar tenant" };
  }
}
