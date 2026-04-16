import { eq } from "drizzle-orm";
import { tenants } from "@/db/schema";
import { getDb } from "@/server/db";

export type TenantAuditScope =
  | "integrations"
  | "products_leads"
  | "users_memberships";

const VALID_SCOPES: TenantAuditScope[] = [
  "integrations",
  "products_leads",
  "users_memberships",
];

export interface TenantFeatureFlags {
  notificationsEnabled: boolean;
  auditEnabled: boolean;
  auditScopes: TenantAuditScope[];
}

const DEFAULT_FLAGS: TenantFeatureFlags = {
  notificationsEnabled: false,
  auditEnabled: false,
  auditScopes: [],
};

export function normalizeTenantFeatureFlags(
  settings: Record<string, unknown> | null | undefined
): TenantFeatureFlags {
  if (!settings || typeof settings !== "object") return DEFAULT_FLAGS;
  const rawFeatures =
    typeof settings.features === "object" && settings.features
      ? (settings.features as Record<string, unknown>)
      : {};

  const notificationsEnabled = rawFeatures.notificationsEnabled === true;
  const auditEnabled = rawFeatures.auditEnabled === true;
  const rawScopes = Array.isArray(rawFeatures.auditScopes)
    ? rawFeatures.auditScopes
    : [];
  const auditScopes = rawScopes
    .filter((scope): scope is TenantAuditScope => {
      return (
        typeof scope === "string" &&
        VALID_SCOPES.includes(scope as TenantAuditScope)
      );
    })
    .filter((scope, index, array) => array.indexOf(scope) === index);

  return {
    notificationsEnabled,
    auditEnabled,
    auditScopes,
  };
}

export function mergeTenantFeatureFlagsInSettings(
  settings: Record<string, unknown> | null | undefined,
  flags: TenantFeatureFlags
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(settings ?? {}) };
  const currentFeatures =
    typeof next.features === "object" && next.features
      ? (next.features as Record<string, unknown>)
      : {};

  next.features = {
    ...currentFeatures,
    notificationsEnabled: flags.notificationsEnabled,
    auditEnabled: flags.auditEnabled,
    auditScopes: flags.auditScopes,
  };

  return next;
}

export async function getTenantFeatureFlags(
  tenantId: string
): Promise<TenantFeatureFlags> {
  const db = getDb();
  const [row] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return normalizeTenantFeatureFlags(row?.settings ?? null);
}

export async function canUseTenantNotifications(
  tenantId: string
): Promise<boolean> {
  const flags = await getTenantFeatureFlags(tenantId);
  return flags.notificationsEnabled;
}

export async function canUseTenantAudit(
  tenantId: string,
  scope: TenantAuditScope
): Promise<boolean> {
  const flags = await getTenantFeatureFlags(tenantId);
  return flags.auditEnabled && flags.auditScopes.includes(scope);
}

