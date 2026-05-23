/**
 * CRUD da config SMTP por tenant. Chamador deve usar requireAdmin.
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { tenantSmtpConfigs } from "@/db/schema";
import { encryptSecretForStorage } from "@/server/security/secret-storage";
import { recordTenantActivity } from "@/server/tenancy/tenant-activity";

export interface TenantSmtpConfigPublic {
  tenantId: string;
  host: string;
  port: number;
  username: string | null;
  fromEmail: string;
  fromName: string | null;
  replyTo: string | null;
  secure: boolean;
  requireTls: boolean;
  enabled: boolean;
  hasPassword: boolean;
}

export async function getTenantSmtpConfig(
  tenantId: string
): Promise<TenantSmtpConfigPublic | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(tenantSmtpConfigs)
    .where(eq(tenantSmtpConfigs.tenantId, tenantId))
    .limit(1);
  if (!row) return null;
  return {
    tenantId: row.tenantId,
    host: row.host,
    port: row.port,
    username: row.username,
    fromEmail: row.fromEmail,
    fromName: row.fromName,
    replyTo: row.replyTo,
    secure: row.secure,
    requireTls: row.requireTls,
    enabled: row.enabled,
    hasPassword: Boolean(row.passwordEncrypted),
  };
}

export interface UpsertTenantSmtpInput {
  tenantId: string;
  host: string;
  port: number;
  username?: string | null;
  /** undefined = manter; string vazia = remover; preenchido = atualizar. */
  password?: string | null;
  fromEmail: string;
  fromName?: string | null;
  replyTo?: string | null;
  secure: boolean;
  requireTls: boolean;
  enabled: boolean;
  actorUserId?: string | null;
}

export async function upsertTenantSmtpConfig(
  input: UpsertTenantSmtpInput
): Promise<{ ok: true } | { error: string }> {
  if (!input.host.trim() || !input.fromEmail.trim()) {
    return { error: "host e from_email são obrigatórios" };
  }
  if (!Number.isFinite(input.port) || input.port <= 0 || input.port > 65535) {
    return { error: "port inválido (1..65535)" };
  }

  const db = getDb();
  const [existing] = await db
    .select({ tenantId: tenantSmtpConfigs.tenantId, hasPwd: tenantSmtpConfigs.passwordEncrypted })
    .from(tenantSmtpConfigs)
    .where(eq(tenantSmtpConfigs.tenantId, input.tenantId))
    .limit(1);

  let passwordEncrypted: string | null | undefined;
  if (input.password !== undefined) {
    passwordEncrypted = input.password?.trim()
      ? encryptSecretForStorage(input.password.trim(), "tenantSmtp.password")
      : null;
  }

  const baseValues = {
    host: input.host.trim(),
    port: input.port,
    username: input.username?.trim() || null,
    fromEmail: input.fromEmail.trim(),
    fromName: input.fromName?.trim() || null,
    replyTo: input.replyTo?.trim() || null,
    secure: input.secure,
    requireTls: input.requireTls,
    enabled: input.enabled,
  };

  if (existing) {
    const updates: Record<string, unknown> = { ...baseValues };
    if (passwordEncrypted !== undefined) {
      updates.passwordEncrypted = passwordEncrypted;
    }
    await db
      .update(tenantSmtpConfigs)
      .set(updates)
      .where(eq(tenantSmtpConfigs.tenantId, input.tenantId));
  } else {
    await db.insert(tenantSmtpConfigs).values({
      tenantId: input.tenantId,
      ...baseValues,
      passwordEncrypted: passwordEncrypted ?? null,
    });
  }

  await recordTenantActivity({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId ?? null,
    scope: "integrations",
    action: existing ? "update" : "create",
    notificationType: existing ? "tenant_smtp_updated" : "tenant_smtp_configured",
    title: existing ? "SMTP do tenant atualizado" : "SMTP do tenant configurado",
    message: `Host ${baseValues.host} / from ${baseValues.fromEmail}.`,
    resourceType: "tenant_smtp_config",
    resourceId: input.tenantId,
    newValues: {
      host: baseValues.host,
      port: baseValues.port,
      fromEmail: baseValues.fromEmail,
      enabled: baseValues.enabled,
    },
    metadata: { provider: "smtp" },
  });

  return { ok: true };
}

export async function deleteTenantSmtpConfig(
  tenantId: string,
  actorUserId?: string | null
): Promise<{ ok: true } | { error: string }> {
  const db = getDb();
  const result = await db
    .delete(tenantSmtpConfigs)
    .where(eq(tenantSmtpConfigs.tenantId, tenantId))
    .returning({ tenantId: tenantSmtpConfigs.tenantId });
  if (result.length === 0) {
    return { error: "Config SMTP não encontrada" };
  }
  await recordTenantActivity({
    tenantId,
    actorUserId: actorUserId ?? null,
    scope: "integrations",
    action: "delete",
    notificationType: "tenant_smtp_removed",
    title: "SMTP do tenant removido",
    message: "Tenant voltará a usar SMTP global do ambiente.",
    resourceType: "tenant_smtp_config",
    resourceId: tenantId,
    metadata: { provider: "smtp" },
  });
  return { ok: true };
}
