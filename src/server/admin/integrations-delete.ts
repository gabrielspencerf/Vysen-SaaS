/**
 * Excluir integrações (Evolution, Typebot, UAZAPI). Chamador deve usar requireAdmin.
 * FK em cascade: ao excluir instância, eventos brutos e conversas vinculadas são removidos.
 */
import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  evolutionInstances,
  typebotBots,
  uazapiInstances,
  chatwootAccounts,
  whatsappCloudNumbers,
  integrations,
} from "@/db/schema";
import { recordTenantActivity } from "@/server/tenancy/tenant-activity";

export async function deleteEvolutionInstance(
  instanceId: string,
  actorUserId?: string | null
): Promise<{ ok: true } | { error: string }> {
  const db = getDb();
  const [row] = await db
    .select({
      id: evolutionInstances.id,
      tenantId: evolutionInstances.tenantId,
      externalId: evolutionInstances.externalId,
      instanceName: evolutionInstances.instanceName,
    })
    .from(evolutionInstances)
    .where(eq(evolutionInstances.id, instanceId))
    .limit(1);
  if (!row) {
    return { error: "Instância Evolution não encontrada" };
  }
  await db
    .delete(integrations)
    .where(
      and(
        eq(integrations.provider, "evolution"),
        eq(integrations.providerResourceId, instanceId)
      )
    );
  await db.delete(evolutionInstances).where(eq(evolutionInstances.id, instanceId));
  await recordTenantActivity({
    tenantId: row.tenantId,
    actorUserId: actorUserId ?? null,
    scope: "integrations",
    action: "delete",
    notificationType: "integration_deleted",
    title: "Integração Evolution removida",
    message: `Instância ${row.instanceName?.trim() || row.externalId} foi removida.`,
    resourceType: "integration_evolution",
    resourceId: row.id,
    oldValues: {
      externalId: row.externalId,
      instanceName: row.instanceName,
    },
    metadata: {
      provider: "evolution",
      integrationId: row.id,
    },
  });
  return { ok: true };
}

export async function deleteTypebotBot(
  botId: string,
  actorUserId?: string | null
): Promise<{ ok: true } | { error: string }> {
  const db = getDb();
  const [row] = await db
    .select({
      id: typebotBots.id,
      tenantId: typebotBots.tenantId,
      externalId: typebotBots.externalId,
      name: typebotBots.name,
    })
    .from(typebotBots)
    .where(eq(typebotBots.id, botId))
    .limit(1);
  if (!row) {
    return { error: "Bot Typebot não encontrado" };
  }
  await db
    .delete(integrations)
    .where(
      and(
        eq(integrations.provider, "typebot"),
        eq(integrations.providerResourceId, botId)
      )
    );
  await db.delete(typebotBots).where(eq(typebotBots.id, botId));
  await recordTenantActivity({
    tenantId: row.tenantId,
    actorUserId: actorUserId ?? null,
    scope: "integrations",
    action: "delete",
    notificationType: "integration_deleted",
    title: "Integração Typebot removida",
    message: `Bot ${row.name?.trim() || row.externalId} foi removido.`,
    resourceType: "integration_typebot",
    resourceId: row.id,
    oldValues: {
      externalId: row.externalId,
      name: row.name,
    },
    metadata: {
      provider: "typebot",
      integrationId: row.id,
    },
  });
  return { ok: true };
}

export async function deleteUazapiInstance(
  instanceId: string,
  actorUserId?: string | null
): Promise<{ ok: true } | { error: string }> {
  const db = getDb();
  const [row] = await db
    .select({
      id: uazapiInstances.id,
      tenantId: uazapiInstances.tenantId,
      externalId: uazapiInstances.externalId,
      instanceName: uazapiInstances.instanceName,
    })
    .from(uazapiInstances)
    .where(eq(uazapiInstances.id, instanceId))
    .limit(1);
  if (!row) {
    return { error: "Instância UAZAPI não encontrada" };
  }
  await db
    .delete(integrations)
    .where(
      and(
        eq(integrations.provider, "uazapi"),
        eq(integrations.providerResourceId, instanceId)
      )
    );
  await db.delete(uazapiInstances).where(eq(uazapiInstances.id, instanceId));
  await recordTenantActivity({
    tenantId: row.tenantId,
    actorUserId: actorUserId ?? null,
    scope: "integrations",
    action: "delete",
    notificationType: "integration_deleted",
    title: "Integração UAZAPI removida",
    message: `Instância ${row.instanceName?.trim() || row.externalId} foi removida.`,
    resourceType: "integration_uazapi",
    resourceId: row.id,
    oldValues: {
      externalId: row.externalId,
      instanceName: row.instanceName,
    },
    metadata: {
      provider: "uazapi",
      integrationId: row.id,
    },
  });
  return { ok: true };
}

export async function deleteChatwootAccount(
  accountId: string,
  actorUserId?: string | null
): Promise<{ ok: true } | { error: string }> {
  const db = getDb();
  const [row] = await db
    .select({
      id: chatwootAccounts.id,
      tenantId: chatwootAccounts.tenantId,
      externalId: chatwootAccounts.externalId,
      label: chatwootAccounts.label,
    })
    .from(chatwootAccounts)
    .where(eq(chatwootAccounts.id, accountId))
    .limit(1);
  if (!row) return { error: "Conta Chatwoot não encontrada" };
  await db
    .delete(integrations)
    .where(
      and(
        eq(integrations.provider, "chatwoot"),
        eq(integrations.providerResourceId, accountId)
      )
    );
  await db.delete(chatwootAccounts).where(eq(chatwootAccounts.id, accountId));
  await recordTenantActivity({
    tenantId: row.tenantId,
    actorUserId: actorUserId ?? null,
    scope: "integrations",
    action: "delete",
    notificationType: "integration_deleted",
    title: "Integração Chatwoot removida",
    message: `Conta ${row.label?.trim() || row.externalId} foi removida.`,
    resourceType: "integration_chatwoot",
    resourceId: row.id,
    oldValues: { externalId: row.externalId, label: row.label },
    metadata: { provider: "chatwoot", integrationId: row.id },
  });
  return { ok: true };
}

export async function deleteWhatsappCloudNumber(
  numberId: string,
  actorUserId?: string | null
): Promise<{ ok: true } | { error: string }> {
  const db = getDb();
  const [row] = await db
    .select({
      id: whatsappCloudNumbers.id,
      tenantId: whatsappCloudNumbers.tenantId,
      phoneNumberId: whatsappCloudNumbers.phoneNumberId,
      displayPhone: whatsappCloudNumbers.displayPhone,
      label: whatsappCloudNumbers.label,
    })
    .from(whatsappCloudNumbers)
    .where(eq(whatsappCloudNumbers.id, numberId))
    .limit(1);
  if (!row) return { error: "Número WhatsApp Cloud não encontrado" };
  await db
    .delete(integrations)
    .where(
      and(
        eq(integrations.provider, "whatsapp_cloud"),
        eq(integrations.providerResourceId, numberId)
      )
    );
  await db.delete(whatsappCloudNumbers).where(eq(whatsappCloudNumbers.id, numberId));
  const displayName =
    row.label?.trim() || row.displayPhone?.trim() || row.phoneNumberId;
  await recordTenantActivity({
    tenantId: row.tenantId,
    actorUserId: actorUserId ?? null,
    scope: "integrations",
    action: "delete",
    notificationType: "integration_deleted",
    title: "Integração WhatsApp Cloud removida",
    message: `Número ${displayName} foi removido.`,
    resourceType: "integration_whatsapp_cloud",
    resourceId: row.id,
    oldValues: {
      phoneNumberId: row.phoneNumberId,
      displayPhone: row.displayPhone,
      label: row.label,
    },
    metadata: { provider: "whatsapp_cloud", integrationId: row.id },
  });
  return { ok: true };
}
