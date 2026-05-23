/**
 * Criar Typebot bot e Evolution instance (admin). Chamador deve usar requireAdmin.
 */
import { getDb } from "@/server/db";
import {
  typebotBots,
  evolutionInstances,
  integrations,
  uazapiInstances,
  chatwootAccounts,
  whatsappCloudNumbers,
} from "@/db/schema";
import { hashWebhookSecret } from "@/server/integrations/webhook-secret";
import { encryptSecretForStorage } from "@/server/security/secret-storage";
import { normalizeUazapiCredential } from "@/lib/uazapi-credentials";
import { recordTenantActivity } from "@/server/tenancy/tenant-activity";

function isMissingColumnError(err: unknown, columnName: string): boolean {
  if (!(err instanceof Error)) return false;
  const message = err.message ?? "";
  return message.includes(`coluna \"${columnName}\"`) || message.includes(`column \"${columnName}\"`);
}

function toLegacyCredentialString(input: {
  apiKey: string | null;
  token: string | null;
  adminToken: string | null;
}): string | null {
  if (input.apiKey) return input.apiKey;
  if (input.token && input.adminToken) {
    return `token=${input.token}&admintoken=${input.adminToken}`;
  }
  if (input.token) return input.token;
  return null;
}

async function ensureIntegrationRecord(args: {
  tenantId: string;
  provider: "typebot" | "evolution" | "uazapi" | "chatwoot" | "whatsapp_cloud";
  name: string;
  providerResourceId: string;
}) {
  const db = getDb();
  await db
    .insert(integrations)
    .values({
      tenantId: args.tenantId,
      provider: args.provider,
      name: args.name,
      providerResourceId: args.providerResourceId,
      isActive: true,
    })
    .onConflictDoNothing();
}

export interface CreateTypebotBotInput {
  tenantId: string;
  externalId: string;
  name?: string | null;
  webhookSecret?: string | null;
  apiToken?: string | null;
  metricsApiBaseUrl?: string | null;
  actorUserId?: string | null;
}

export async function createTypebotBot(input: CreateTypebotBotInput) {
  const db = getDb();
  const webhookSecretHash =
    input.webhookSecret?.trim() ?
      hashWebhookSecret(input.webhookSecret.trim())
    : null;
  const webhookSecretEncrypted =
    input.webhookSecret?.trim()
      ? encryptSecretForStorage(input.webhookSecret.trim(), "createTypebotBot:webhookSecret")
      : null;
  const apiTokenEncrypted =
    input.apiToken?.trim()
      ? encryptSecretForStorage(input.apiToken.trim(), "createTypebotBot:apiToken")
      : null;
  const metricsApiBaseUrl =
    input.metricsApiBaseUrl?.trim() ? input.metricsApiBaseUrl.trim().replace(/\/$/, "") : null;

  try {
    const [row] = await db
      .insert(typebotBots)
      .values({
        tenantId: input.tenantId,
        externalId: input.externalId.trim(),
        name: input.name?.trim() || null,
        webhookSecretHash,
        webhookSecretEncrypted,
        apiTokenEncrypted,
        metricsApiBaseUrl,
      })
      .returning({
        id: typebotBots.id,
        tenantId: typebotBots.tenantId,
        externalId: typebotBots.externalId,
        name: typebotBots.name,
      });

    if (!row) {
      return { error: "Falha ao criar bot" };
    }
    await ensureIntegrationRecord({
      tenantId: row.tenantId,
      provider: "typebot",
      name: row.name?.trim() || row.externalId,
      providerResourceId: row.id,
    });
    await recordTenantActivity({
      tenantId: row.tenantId,
      actorUserId: input.actorUserId ?? null,
      scope: "integrations",
      action: "create",
      notificationType: "integration_created",
      title: "Integração Typebot criada",
      message: `Bot ${row.name?.trim() || row.externalId} foi conectado.`,
      resourceType: "integration_typebot",
      resourceId: row.id,
      newValues: {
        externalId: row.externalId,
        name: row.name,
      },
      metadata: {
        provider: "typebot",
        integrationId: row.id,
      },
    });
    return { id: row.id, tenantId: row.tenantId, externalId: row.externalId, name: row.name };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { error: "Já existe um bot com este tenant e external_id" };
    }
    throw err;
  }
}

export interface CreateEvolutionInstanceInput {
  tenantId: string;
  externalId: string;
  baseUrl: string;
  apiKey?: string | null;
  instanceName?: string | null;
  actorUserId?: string | null;
}

export async function createEvolutionInstance(input: CreateEvolutionInstanceInput) {
  const db = getDb();
  const baseUrl = input.baseUrl.replace(/\/$/, "");
  const apiKeyEncrypted =
    input.apiKey?.trim()
      ? encryptSecretForStorage(input.apiKey.trim(), "createEvolutionInstance:apiKey")
      : null;

  try {
    const [row] = await db
      .insert(evolutionInstances)
      .values({
        tenantId: input.tenantId,
        externalId: input.externalId.trim(),
        baseUrl,
        apiKeyEncrypted,
        instanceName: input.instanceName?.trim() || null,
      })
      .returning({
        id: evolutionInstances.id,
        tenantId: evolutionInstances.tenantId,
        externalId: evolutionInstances.externalId,
        baseUrl: evolutionInstances.baseUrl,
        instanceName: evolutionInstances.instanceName,
      });

    if (!row) {
      return { error: "Falha ao criar instância" };
    }
    await ensureIntegrationRecord({
      tenantId: row.tenantId,
      provider: "evolution",
      name: row.instanceName?.trim() || row.externalId,
      providerResourceId: row.id,
    });
    await recordTenantActivity({
      tenantId: row.tenantId,
      actorUserId: input.actorUserId ?? null,
      scope: "integrations",
      action: "create",
      notificationType: "integration_created",
      title: "Integração Evolution criada",
      message: `Instância ${row.instanceName?.trim() || row.externalId} foi conectada.`,
      resourceType: "integration_evolution",
      resourceId: row.id,
      newValues: {
        externalId: row.externalId,
        baseUrl: row.baseUrl,
        instanceName: row.instanceName,
      },
      metadata: {
        provider: "evolution",
        integrationId: row.id,
      },
    });
    return {
      id: row.id,
      tenantId: row.tenantId,
      externalId: row.externalId,
      baseUrl: row.baseUrl,
      instanceName: row.instanceName,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { error: "Já existe uma instância com este tenant e external_id" };
    }
    throw err;
  }
}

export interface CreateUazapiInstanceInput {
  tenantId: string;
  externalId: string;
  baseUrl: string;
  apiKey?: string | null;
  token?: string | null;
  adminToken?: string | null;
  legacyCredential?: string | null;
  instanceName?: string | null;
  actorUserId?: string | null;
}

export async function createUazapiInstance(input: CreateUazapiInstanceInput) {
  const db = getDb();
  const baseUrl = input.baseUrl.replace(/\/$/, "");
  const normalizedCredential = normalizeUazapiCredential({
    apiKey: input.apiKey ?? null,
    token: input.token ?? null,
    adminToken: input.adminToken ?? null,
    legacyCredential: input.legacyCredential ?? null,
  });
  const apiKeyEncrypted =
    normalizedCredential.apiKey
      ? encryptSecretForStorage(normalizedCredential.apiKey, "createUazapiInstance:apiKey")
      : null;
  const tokenEncrypted =
    normalizedCredential.token
      ? encryptSecretForStorage(normalizedCredential.token, "createUazapiInstance:token")
      : null;
  const adminTokenEncrypted =
    normalizedCredential.adminToken
      ? encryptSecretForStorage(
          normalizedCredential.adminToken,
          "createUazapiInstance:adminToken"
        )
      : null;
  const legacyCredential = toLegacyCredentialString({
    apiKey: normalizedCredential.apiKey,
    token: normalizedCredential.token,
    adminToken: normalizedCredential.adminToken,
  });
  const legacyCredentialEncrypted = legacyCredential
    ? encryptSecretForStorage(legacyCredential, "createUazapiInstance:legacyCredential")
    : null;

  try {
    let row:
      | {
          id: string;
          tenantId: string;
          externalId: string;
          baseUrl: string;
          instanceName: string | null;
        }
      | undefined;
    try {
      [row] = await db
        .insert(uazapiInstances)
        .values({
          tenantId: input.tenantId,
          externalId: input.externalId.trim(),
          baseUrl,
          apiKeyEncrypted,
          tokenEncrypted,
          adminTokenEncrypted,
          instanceName: input.instanceName?.trim() || null,
        })
        .returning({
          id: uazapiInstances.id,
          tenantId: uazapiInstances.tenantId,
          externalId: uazapiInstances.externalId,
          baseUrl: uazapiInstances.baseUrl,
          instanceName: uazapiInstances.instanceName,
        });
    } catch (insertErr) {
      if (!isMissingColumnError(insertErr, "token_encrypted")) {
        throw insertErr;
      }
      [row] = await db
        .insert(uazapiInstances)
        .values({
          tenantId: input.tenantId,
          externalId: input.externalId.trim(),
          baseUrl,
          apiKeyEncrypted: legacyCredentialEncrypted,
          instanceName: input.instanceName?.trim() || null,
        })
        .returning({
          id: uazapiInstances.id,
          tenantId: uazapiInstances.tenantId,
          externalId: uazapiInstances.externalId,
          baseUrl: uazapiInstances.baseUrl,
          instanceName: uazapiInstances.instanceName,
        });
    }

    if (!row) {
      return { error: "Falha ao criar instância UAZAPI" };
    }

    await ensureIntegrationRecord({
      tenantId: row.tenantId,
      provider: "uazapi",
      name: row.instanceName?.trim() || row.externalId,
      providerResourceId: row.id,
    });
    await recordTenantActivity({
      tenantId: row.tenantId,
      actorUserId: input.actorUserId ?? null,
      scope: "integrations",
      action: "create",
      notificationType: "integration_created",
      title: "Integração UAZAPI criada",
      message: `Instância ${row.instanceName?.trim() || row.externalId} foi conectada.`,
      resourceType: "integration_uazapi",
      resourceId: row.id,
      newValues: {
        externalId: row.externalId,
        baseUrl: row.baseUrl,
        instanceName: row.instanceName,
      },
      metadata: {
        provider: "uazapi",
        integrationId: row.id,
      },
    });

    return {
      id: row.id,
      tenantId: row.tenantId,
      externalId: row.externalId,
      baseUrl: row.baseUrl,
      instanceName: row.instanceName,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { error: "Já existe uma instância UAZAPI com este tenant e external_id" };
    }
    throw err;
  }
}

// ============================================================================
// Chatwoot
// ============================================================================

export interface CreateChatwootAccountInput {
  tenantId: string;
  externalId: string;
  baseUrl: string;
  inboxId?: string | null;
  apiToken?: string | null;
  label?: string | null;
  actorUserId?: string | null;
}

export async function createChatwootAccount(input: CreateChatwootAccountInput) {
  const db = getDb();
  const baseUrl = input.baseUrl.trim().replace(/\/$/, "");
  const apiTokenEncrypted = input.apiToken?.trim()
    ? encryptSecretForStorage(input.apiToken.trim(), "createChatwootAccount:apiToken")
    : null;

  try {
    const [row] = await db
      .insert(chatwootAccounts)
      .values({
        tenantId: input.tenantId,
        externalId: input.externalId.trim(),
        baseUrl,
        inboxId: input.inboxId?.trim() || null,
        apiTokenEncrypted,
        label: input.label?.trim() || null,
      })
      .returning({
        id: chatwootAccounts.id,
        tenantId: chatwootAccounts.tenantId,
        externalId: chatwootAccounts.externalId,
        baseUrl: chatwootAccounts.baseUrl,
        inboxId: chatwootAccounts.inboxId,
        label: chatwootAccounts.label,
      });
    if (!row) return { error: "Falha ao criar account Chatwoot" };

    await ensureIntegrationRecord({
      tenantId: row.tenantId,
      provider: "chatwoot",
      name: row.label?.trim() || row.externalId,
      providerResourceId: row.id,
    });
    await recordTenantActivity({
      tenantId: row.tenantId,
      actorUserId: input.actorUserId ?? null,
      scope: "integrations",
      action: "create",
      notificationType: "integration_created",
      title: "Integração Chatwoot criada",
      message: `Conta ${row.label?.trim() || row.externalId} foi conectada.`,
      resourceType: "integration_chatwoot",
      resourceId: row.id,
      newValues: {
        externalId: row.externalId,
        baseUrl: row.baseUrl,
        inboxId: row.inboxId,
        label: row.label,
      },
      metadata: { provider: "chatwoot", integrationId: row.id },
    });
    return {
      id: row.id,
      tenantId: row.tenantId,
      externalId: row.externalId,
      baseUrl: row.baseUrl,
      inboxId: row.inboxId,
      label: row.label,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { error: "Já existe uma conta Chatwoot com este tenant e external_id" };
    }
    throw err;
  }
}

// ============================================================================
// WhatsApp Cloud
// ============================================================================

export interface CreateWhatsappCloudNumberInput {
  tenantId: string;
  phoneNumberId: string;
  wabaId: string;
  displayPhone?: string | null;
  accessToken?: string | null;
  webhookVerifyToken?: string | null;
  label?: string | null;
  actorUserId?: string | null;
}

export async function createWhatsappCloudNumber(input: CreateWhatsappCloudNumberInput) {
  const db = getDb();
  const accessTokenEncrypted = input.accessToken?.trim()
    ? encryptSecretForStorage(input.accessToken.trim(), "createWhatsappCloudNumber:accessToken")
    : null;

  try {
    const [row] = await db
      .insert(whatsappCloudNumbers)
      .values({
        tenantId: input.tenantId,
        phoneNumberId: input.phoneNumberId.trim(),
        wabaId: input.wabaId.trim(),
        displayPhone: input.displayPhone?.trim() || null,
        accessTokenEncrypted,
        webhookVerifyToken: input.webhookVerifyToken?.trim() || null,
        label: input.label?.trim() || null,
      })
      .returning({
        id: whatsappCloudNumbers.id,
        tenantId: whatsappCloudNumbers.tenantId,
        phoneNumberId: whatsappCloudNumbers.phoneNumberId,
        wabaId: whatsappCloudNumbers.wabaId,
        displayPhone: whatsappCloudNumbers.displayPhone,
        label: whatsappCloudNumbers.label,
      });
    if (!row) return { error: "Falha ao criar número WhatsApp Cloud" };

    await ensureIntegrationRecord({
      tenantId: row.tenantId,
      provider: "whatsapp_cloud",
      name: row.label?.trim() || row.displayPhone?.trim() || row.phoneNumberId,
      providerResourceId: row.id,
    });
    await recordTenantActivity({
      tenantId: row.tenantId,
      actorUserId: input.actorUserId ?? null,
      scope: "integrations",
      action: "create",
      notificationType: "integration_created",
      title: "Integração WhatsApp Cloud criada",
      message: `Número ${row.label?.trim() || row.displayPhone?.trim() || row.phoneNumberId} foi conectado.`,
      resourceType: "integration_whatsapp_cloud",
      resourceId: row.id,
      newValues: {
        phoneNumberId: row.phoneNumberId,
        wabaId: row.wabaId,
        displayPhone: row.displayPhone,
        label: row.label,
      },
      metadata: { provider: "whatsapp_cloud", integrationId: row.id },
    });
    return {
      id: row.id,
      tenantId: row.tenantId,
      phoneNumberId: row.phoneNumberId,
      wabaId: row.wabaId,
      displayPhone: row.displayPhone,
      label: row.label,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return {
        error: "Já existe um número WhatsApp Cloud com este tenant e phone_number_id",
      };
    }
    throw err;
  }
}
