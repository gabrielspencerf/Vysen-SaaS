/**
 * Leitura e atualização de integrações (Evolution e UAZAPI) por id.
 * Chamador deve usar requireAdmin na camada de rota.
 */
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  evolutionInstances,
  typebotBots,
  uazapiInstances,
  chatwootAccounts,
  whatsappCloudNumbers,
} from "@/db/schema";
import { encryptSecretForStorage } from "@/server/security/secret-storage";
import { normalizeUazapiCredential } from "@/lib/uazapi-credentials";
import { recordTenantActivity } from "@/server/tenancy/tenant-activity";
import { hashWebhookSecret } from "@/server/integrations/webhook-secret";

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

type IntegrationNotFound = { error: "not_found" };
type IntegrationDuplicate = { error: "duplicate_external_id" };

export async function getEvolutionInstanceById(
  id: string
): Promise<
  | {
      id: string;
      tenantId: string;
      externalId: string;
      baseUrl: string;
      instanceName: string | null;
    }
  | IntegrationNotFound
> {
  const db = getDb();
  const [row] = await db
    .select({
      id: evolutionInstances.id,
      tenantId: evolutionInstances.tenantId,
      externalId: evolutionInstances.externalId,
      baseUrl: evolutionInstances.baseUrl,
      instanceName: evolutionInstances.instanceName,
    })
    .from(evolutionInstances)
    .where(eq(evolutionInstances.id, id))
    .limit(1);

  if (!row) return { error: "not_found" };
  return row;
}

export async function updateEvolutionInstanceById(input: {
  id: string;
  externalId: string;
  baseUrl: string;
  instanceName?: string | null;
  apiKey?: string | null;
  actorUserId?: string | null;
}): Promise<
  | {
      id: string;
      tenantId: string;
      externalId: string;
      baseUrl: string;
      instanceName: string | null;
    }
  | IntegrationNotFound
  | IntegrationDuplicate
> {
  const db = getDb();
  const [current] = await db
    .select({
      id: evolutionInstances.id,
      tenantId: evolutionInstances.tenantId,
      externalId: evolutionInstances.externalId,
      baseUrl: evolutionInstances.baseUrl,
      instanceName: evolutionInstances.instanceName,
    })
    .from(evolutionInstances)
    .where(eq(evolutionInstances.id, input.id))
    .limit(1);
  if (!current) return { error: "not_found" };

  const normalizedExternalId = input.externalId.trim();
  const normalizedBaseUrl = input.baseUrl.trim().replace(/\/$/, "");
  const normalizedName = input.instanceName?.trim() || null;
  const normalizedApiKey = input.apiKey?.trim();

  const [duplicate] = await db
    .select({ id: evolutionInstances.id })
    .from(evolutionInstances)
    .where(
      and(
        eq(evolutionInstances.tenantId, current.tenantId),
        eq(evolutionInstances.externalId, normalizedExternalId),
        ne(evolutionInstances.id, input.id)
      )
    )
    .limit(1);
  if (duplicate) return { error: "duplicate_external_id" };

  const values: {
    externalId: string;
    baseUrl: string;
    instanceName: string | null;
    apiKeyEncrypted?: string | null;
  } = {
    externalId: normalizedExternalId,
    baseUrl: normalizedBaseUrl,
    instanceName: normalizedName,
  };
  if (normalizedApiKey) {
    values.apiKeyEncrypted = encryptSecretForStorage(
      normalizedApiKey,
      "updateEvolutionInstanceById:apiKey"
    );
  }

  const [updated] = await db
    .update(evolutionInstances)
    .set(values)
    .where(eq(evolutionInstances.id, input.id))
    .returning({
      id: evolutionInstances.id,
      tenantId: evolutionInstances.tenantId,
      externalId: evolutionInstances.externalId,
      baseUrl: evolutionInstances.baseUrl,
      instanceName: evolutionInstances.instanceName,
    });

  if (!updated) return { error: "not_found" };
  await recordTenantActivity({
    tenantId: updated.tenantId,
    actorUserId: input.actorUserId ?? null,
    scope: "integrations",
    action: "update",
    notificationType: "integration_updated",
    title: "Integração Evolution atualizada",
    message: `Instância ${updated.instanceName?.trim() || updated.externalId} foi atualizada.`,
    resourceType: "integration_evolution",
    resourceId: updated.id,
    oldValues: {
      externalId: current.externalId,
      baseUrl: current.baseUrl,
      instanceName: current.instanceName,
    },
    newValues: {
      externalId: updated.externalId,
      baseUrl: updated.baseUrl,
      instanceName: updated.instanceName,
    },
    metadata: {
      provider: "evolution",
      integrationId: updated.id,
    },
  });
  return updated;
}

export async function getUazapiInstanceById(
  id: string
): Promise<
  | {
      id: string;
      tenantId: string;
      externalId: string;
      baseUrl: string;
      instanceName: string | null;
      hasApiKey: boolean;
      hasToken: boolean;
      hasAdminToken: boolean;
    }
  | IntegrationNotFound
> {
  const db = getDb();
  let row:
    | {
        id: string;
        tenantId: string;
        externalId: string;
        baseUrl: string;
        instanceName: string | null;
        hasApiKey: string | null;
        hasToken: string | null;
        hasAdminToken: string | null;
      }
    | undefined;
  try {
    [row] = await db
      .select({
        id: uazapiInstances.id,
        tenantId: uazapiInstances.tenantId,
        externalId: uazapiInstances.externalId,
        baseUrl: uazapiInstances.baseUrl,
        instanceName: uazapiInstances.instanceName,
        hasApiKey: uazapiInstances.apiKeyEncrypted,
        hasToken: uazapiInstances.tokenEncrypted,
        hasAdminToken: uazapiInstances.adminTokenEncrypted,
      })
      .from(uazapiInstances)
      .where(eq(uazapiInstances.id, id))
      .limit(1);
  } catch (err) {
    if (!isMissingColumnError(err, "token_encrypted")) {
      throw err;
    }
    const [legacyRow] = await db
      .select({
        id: uazapiInstances.id,
        tenantId: uazapiInstances.tenantId,
        externalId: uazapiInstances.externalId,
        baseUrl: uazapiInstances.baseUrl,
        instanceName: uazapiInstances.instanceName,
        hasApiKey: uazapiInstances.apiKeyEncrypted,
      })
      .from(uazapiInstances)
      .where(eq(uazapiInstances.id, id))
      .limit(1);
    if (!legacyRow) {
      row = undefined;
    } else {
      row = {
        ...legacyRow,
        hasToken: null,
        hasAdminToken: null,
      };
    }
  }

  if (!row) return { error: "not_found" };
  return {
    ...row,
    hasApiKey: Boolean(row.hasApiKey),
    hasToken: Boolean(row.hasToken),
    hasAdminToken: Boolean(row.hasAdminToken),
  };
}

export async function updateUazapiInstanceById(input: {
  id: string;
  externalId: string;
  baseUrl: string;
  instanceName?: string | null;
  apiKey?: string | null;
  token?: string | null;
  adminToken?: string | null;
  legacyCredential?: string | null;
  actorUserId?: string | null;
}): Promise<
  | {
      id: string;
      tenantId: string;
      externalId: string;
      baseUrl: string;
      instanceName: string | null;
    }
  | IntegrationNotFound
  | IntegrationDuplicate
> {
  const db = getDb();
  const [current] = await db
    .select({
      id: uazapiInstances.id,
      tenantId: uazapiInstances.tenantId,
      externalId: uazapiInstances.externalId,
      baseUrl: uazapiInstances.baseUrl,
      instanceName: uazapiInstances.instanceName,
    })
    .from(uazapiInstances)
    .where(eq(uazapiInstances.id, input.id))
    .limit(1);
  if (!current) return { error: "not_found" };

  const normalizedExternalId = input.externalId.trim();
  const normalizedBaseUrl = input.baseUrl.trim().replace(/\/$/, "");
  const normalizedName = input.instanceName?.trim() || null;
  const normalizedCredential = normalizeUazapiCredential({
    apiKey: input.apiKey ?? null,
    token: input.token ?? null,
    adminToken: input.adminToken ?? null,
    legacyCredential: input.legacyCredential ?? null,
  });

  const [duplicate] = await db
    .select({ id: uazapiInstances.id })
    .from(uazapiInstances)
    .where(
      and(
        eq(uazapiInstances.tenantId, current.tenantId),
        eq(uazapiInstances.externalId, normalizedExternalId),
        ne(uazapiInstances.id, input.id)
      )
    )
    .limit(1);
  if (duplicate) return { error: "duplicate_external_id" };

  const values: {
    externalId: string;
    baseUrl: string;
    instanceName: string | null;
    apiKeyEncrypted?: string | null;
    tokenEncrypted?: string | null;
    adminTokenEncrypted?: string | null;
  } = {
    externalId: normalizedExternalId,
    baseUrl: normalizedBaseUrl,
    instanceName: normalizedName,
  };
  if (normalizedCredential.apiKey) {
    values.apiKeyEncrypted = encryptSecretForStorage(
      normalizedCredential.apiKey,
      "updateUazapiInstanceById:apiKey"
    );
  }
  if (normalizedCredential.token) {
    values.tokenEncrypted = encryptSecretForStorage(
      normalizedCredential.token,
      "updateUazapiInstanceById:token"
    );
  }
  if (normalizedCredential.adminToken) {
    values.adminTokenEncrypted = encryptSecretForStorage(
      normalizedCredential.adminToken,
      "updateUazapiInstanceById:adminToken"
    );
  }
  const legacyCredential = toLegacyCredentialString({
    apiKey: normalizedCredential.apiKey,
    token: normalizedCredential.token,
    adminToken: normalizedCredential.adminToken,
  });
  const legacyCredentialEncrypted = legacyCredential
    ? encryptSecretForStorage(legacyCredential, "updateUazapiInstanceById:legacyCredential")
    : null;

  let updated:
    | {
        id: string;
        tenantId: string;
        externalId: string;
        baseUrl: string;
        instanceName: string | null;
      }
    | undefined;
  try {
    [updated] = await db
      .update(uazapiInstances)
      .set(values)
      .where(eq(uazapiInstances.id, input.id))
      .returning({
        id: uazapiInstances.id,
        tenantId: uazapiInstances.tenantId,
        externalId: uazapiInstances.externalId,
        baseUrl: uazapiInstances.baseUrl,
        instanceName: uazapiInstances.instanceName,
      });
  } catch (err) {
    if (!isMissingColumnError(err, "token_encrypted")) {
      throw err;
    }
    const legacyValues: {
      externalId: string;
      baseUrl: string;
      instanceName: string | null;
      apiKeyEncrypted?: string | null;
    } = {
      externalId: normalizedExternalId,
      baseUrl: normalizedBaseUrl,
      instanceName: normalizedName,
    };
    if (legacyCredentialEncrypted) {
      legacyValues.apiKeyEncrypted = legacyCredentialEncrypted;
    }
    [updated] = await db
      .update(uazapiInstances)
      .set(legacyValues)
      .where(eq(uazapiInstances.id, input.id))
      .returning({
        id: uazapiInstances.id,
        tenantId: uazapiInstances.tenantId,
        externalId: uazapiInstances.externalId,
        baseUrl: uazapiInstances.baseUrl,
        instanceName: uazapiInstances.instanceName,
      });
  }

  if (!updated) return { error: "not_found" };
  await recordTenantActivity({
    tenantId: updated.tenantId,
    actorUserId: input.actorUserId ?? null,
    scope: "integrations",
    action: "update",
    notificationType: "integration_updated",
    title: "Integração UAZAPI atualizada",
    message: `Instância ${updated.instanceName?.trim() || updated.externalId} foi atualizada.`,
    resourceType: "integration_uazapi",
    resourceId: updated.id,
    oldValues: {
      externalId: current.externalId,
      baseUrl: current.baseUrl,
      instanceName: current.instanceName,
    },
    newValues: {
      externalId: updated.externalId,
      baseUrl: updated.baseUrl,
      instanceName: updated.instanceName,
    },
    metadata: {
      provider: "uazapi",
      integrationId: updated.id,
    },
  });
  return updated;
}

// ============================================================================
// Typebot
// ============================================================================

export async function getTypebotBotById(
  id: string
): Promise<
  | {
      id: string;
      tenantId: string;
      externalId: string;
      name: string | null;
      metricsApiBaseUrl: string | null;
      hasWebhookSecret: boolean;
      hasApiToken: boolean;
    }
  | IntegrationNotFound
> {
  const db = getDb();
  const [row] = await db
    .select({
      id: typebotBots.id,
      tenantId: typebotBots.tenantId,
      externalId: typebotBots.externalId,
      name: typebotBots.name,
      metricsApiBaseUrl: typebotBots.metricsApiBaseUrl,
      webhookSecretEncrypted: typebotBots.webhookSecretEncrypted,
      apiTokenEncrypted: typebotBots.apiTokenEncrypted,
    })
    .from(typebotBots)
    .where(eq(typebotBots.id, id))
    .limit(1);
  if (!row) return { error: "not_found" };
  return {
    id: row.id,
    tenantId: row.tenantId,
    externalId: row.externalId,
    name: row.name,
    metricsApiBaseUrl: row.metricsApiBaseUrl,
    hasWebhookSecret: Boolean(row.webhookSecretEncrypted),
    hasApiToken: Boolean(row.apiTokenEncrypted),
  };
}

export async function updateTypebotBotById(input: {
  id: string;
  externalId?: string;
  name?: string | null;
  metricsApiBaseUrl?: string | null;
  /** Se fornecido (mesmo string vazia), substitui. undefined = mantém atual. */
  webhookSecret?: string | null;
  /** Idem. */
  apiToken?: string | null;
  actorUserId?: string | null;
}): Promise<
  | {
      id: string;
      tenantId: string;
      externalId: string;
      name: string | null;
    }
  | IntegrationNotFound
  | IntegrationDuplicate
> {
  const db = getDb();
  const [current] = await db
    .select({
      id: typebotBots.id,
      tenantId: typebotBots.tenantId,
      externalId: typebotBots.externalId,
      name: typebotBots.name,
    })
    .from(typebotBots)
    .where(eq(typebotBots.id, input.id))
    .limit(1);
  if (!current) return { error: "not_found" };

  // Verifica duplicidade de external_id no mesmo tenant.
  if (input.externalId && input.externalId.trim() !== current.externalId) {
    const [conflict] = await db
      .select({ id: typebotBots.id })
      .from(typebotBots)
      .where(
        and(
          eq(typebotBots.tenantId, current.tenantId),
          eq(typebotBots.externalId, input.externalId.trim()),
          ne(typebotBots.id, current.id)
        )
      )
      .limit(1);
    if (conflict) return { error: "duplicate_external_id" };
  }

  const updates: Record<string, unknown> = {};
  if (input.externalId !== undefined) updates.externalId = input.externalId.trim();
  if (input.name !== undefined) updates.name = input.name?.trim() || null;
  if (input.metricsApiBaseUrl !== undefined) {
    updates.metricsApiBaseUrl =
      input.metricsApiBaseUrl?.trim()
        ? input.metricsApiBaseUrl.trim().replace(/\/$/, "")
        : null;
  }
  if (input.webhookSecret !== undefined) {
    if (input.webhookSecret && input.webhookSecret.trim()) {
      updates.webhookSecretHash = hashWebhookSecret(input.webhookSecret.trim());
      updates.webhookSecretEncrypted = encryptSecretForStorage(
        input.webhookSecret.trim(),
        "updateTypebotBot:webhookSecret"
      );
    } else {
      // string vazia explícita = remover
      updates.webhookSecretHash = null;
      updates.webhookSecretEncrypted = null;
    }
  }
  if (input.apiToken !== undefined) {
    if (input.apiToken && input.apiToken.trim()) {
      updates.apiTokenEncrypted = encryptSecretForStorage(
        input.apiToken.trim(),
        "updateTypebotBot:apiToken"
      );
    } else {
      updates.apiTokenEncrypted = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return {
      id: current.id,
      tenantId: current.tenantId,
      externalId: current.externalId,
      name: current.name,
    };
  }

  const [updated] = await db
    .update(typebotBots)
    .set(updates as Partial<typeof typebotBots.$inferInsert>)
    .where(eq(typebotBots.id, current.id))
    .returning({
      id: typebotBots.id,
      tenantId: typebotBots.tenantId,
      externalId: typebotBots.externalId,
      name: typebotBots.name,
    });
  if (!updated) return { error: "not_found" };

  await recordTenantActivity({
    tenantId: updated.tenantId,
    actorUserId: input.actorUserId ?? null,
    scope: "integrations",
    action: "update",
    notificationType: "integration_updated",
    title: "Integração Typebot atualizada",
    message: `Bot ${updated.name?.trim() || updated.externalId} foi atualizado.`,
    resourceType: "integration_typebot",
    resourceId: updated.id,
    oldValues: {
      externalId: current.externalId,
      name: current.name,
    },
    newValues: {
      externalId: updated.externalId,
      name: updated.name,
    },
    metadata: {
      provider: "typebot",
      integrationId: updated.id,
    },
  });
  return updated;
}

// ============================================================================
// Chatwoot
// ============================================================================

export async function getChatwootAccountById(
  id: string
): Promise<
  | {
      id: string;
      tenantId: string;
      externalId: string;
      baseUrl: string;
      inboxId: string | null;
      label: string | null;
      hasApiToken: boolean;
    }
  | IntegrationNotFound
> {
  const db = getDb();
  const [row] = await db
    .select({
      id: chatwootAccounts.id,
      tenantId: chatwootAccounts.tenantId,
      externalId: chatwootAccounts.externalId,
      baseUrl: chatwootAccounts.baseUrl,
      inboxId: chatwootAccounts.inboxId,
      label: chatwootAccounts.label,
      apiTokenEncrypted: chatwootAccounts.apiTokenEncrypted,
    })
    .from(chatwootAccounts)
    .where(eq(chatwootAccounts.id, id))
    .limit(1);
  if (!row) return { error: "not_found" };
  return {
    id: row.id,
    tenantId: row.tenantId,
    externalId: row.externalId,
    baseUrl: row.baseUrl,
    inboxId: row.inboxId,
    label: row.label,
    hasApiToken: Boolean(row.apiTokenEncrypted),
  };
}

export async function updateChatwootAccountById(input: {
  id: string;
  externalId?: string;
  baseUrl?: string;
  inboxId?: string | null;
  label?: string | null;
  /** string vazia = remover; undefined = manter. */
  apiToken?: string | null;
  actorUserId?: string | null;
}): Promise<
  | {
      id: string;
      tenantId: string;
      externalId: string;
      baseUrl: string;
      inboxId: string | null;
      label: string | null;
    }
  | IntegrationNotFound
  | IntegrationDuplicate
> {
  const db = getDb();
  const [current] = await db
    .select({
      id: chatwootAccounts.id,
      tenantId: chatwootAccounts.tenantId,
      externalId: chatwootAccounts.externalId,
      baseUrl: chatwootAccounts.baseUrl,
      inboxId: chatwootAccounts.inboxId,
      label: chatwootAccounts.label,
    })
    .from(chatwootAccounts)
    .where(eq(chatwootAccounts.id, input.id))
    .limit(1);
  if (!current) return { error: "not_found" };

  if (input.externalId !== undefined && input.externalId.trim() !== current.externalId) {
    const [conflict] = await db
      .select({ id: chatwootAccounts.id })
      .from(chatwootAccounts)
      .where(
        and(
          eq(chatwootAccounts.tenantId, current.tenantId),
          eq(chatwootAccounts.externalId, input.externalId.trim()),
          ne(chatwootAccounts.id, current.id)
        )
      )
      .limit(1);
    if (conflict) return { error: "duplicate_external_id" };
  }

  const updates: Record<string, unknown> = {};
  if (input.externalId !== undefined) updates.externalId = input.externalId.trim();
  if (input.baseUrl !== undefined) updates.baseUrl = input.baseUrl.trim().replace(/\/$/, "");
  if (input.inboxId !== undefined) updates.inboxId = input.inboxId?.trim() || null;
  if (input.label !== undefined) updates.label = input.label?.trim() || null;
  if (input.apiToken !== undefined) {
    updates.apiTokenEncrypted = input.apiToken?.trim()
      ? encryptSecretForStorage(input.apiToken.trim(), "updateChatwootAccount:apiToken")
      : null;
  }

  if (Object.keys(updates).length === 0) {
    return {
      id: current.id,
      tenantId: current.tenantId,
      externalId: current.externalId,
      baseUrl: current.baseUrl,
      inboxId: current.inboxId,
      label: current.label,
    };
  }

  const [updated] = await db
    .update(chatwootAccounts)
    .set(updates as Partial<typeof chatwootAccounts.$inferInsert>)
    .where(eq(chatwootAccounts.id, current.id))
    .returning({
      id: chatwootAccounts.id,
      tenantId: chatwootAccounts.tenantId,
      externalId: chatwootAccounts.externalId,
      baseUrl: chatwootAccounts.baseUrl,
      inboxId: chatwootAccounts.inboxId,
      label: chatwootAccounts.label,
    });
  if (!updated) return { error: "not_found" };

  await recordTenantActivity({
    tenantId: updated.tenantId,
    actorUserId: input.actorUserId ?? null,
    scope: "integrations",
    action: "update",
    notificationType: "integration_updated",
    title: "Integração Chatwoot atualizada",
    message: `Conta ${updated.label?.trim() || updated.externalId} foi atualizada.`,
    resourceType: "integration_chatwoot",
    resourceId: updated.id,
    oldValues: {
      externalId: current.externalId,
      baseUrl: current.baseUrl,
      inboxId: current.inboxId,
      label: current.label,
    },
    newValues: {
      externalId: updated.externalId,
      baseUrl: updated.baseUrl,
      inboxId: updated.inboxId,
      label: updated.label,
    },
    metadata: { provider: "chatwoot", integrationId: updated.id },
  });
  return updated;
}

// ============================================================================
// WhatsApp Cloud
// ============================================================================

export async function getWhatsappCloudNumberById(
  id: string
): Promise<
  | {
      id: string;
      tenantId: string;
      phoneNumberId: string;
      wabaId: string;
      displayPhone: string | null;
      label: string | null;
      webhookVerifyToken: string | null;
      hasAccessToken: boolean;
    }
  | IntegrationNotFound
> {
  const db = getDb();
  const [row] = await db
    .select({
      id: whatsappCloudNumbers.id,
      tenantId: whatsappCloudNumbers.tenantId,
      phoneNumberId: whatsappCloudNumbers.phoneNumberId,
      wabaId: whatsappCloudNumbers.wabaId,
      displayPhone: whatsappCloudNumbers.displayPhone,
      label: whatsappCloudNumbers.label,
      webhookVerifyToken: whatsappCloudNumbers.webhookVerifyToken,
      accessTokenEncrypted: whatsappCloudNumbers.accessTokenEncrypted,
    })
    .from(whatsappCloudNumbers)
    .where(eq(whatsappCloudNumbers.id, id))
    .limit(1);
  if (!row) return { error: "not_found" };
  return {
    id: row.id,
    tenantId: row.tenantId,
    phoneNumberId: row.phoneNumberId,
    wabaId: row.wabaId,
    displayPhone: row.displayPhone,
    label: row.label,
    webhookVerifyToken: row.webhookVerifyToken,
    hasAccessToken: Boolean(row.accessTokenEncrypted),
  };
}

export async function updateWhatsappCloudNumberById(input: {
  id: string;
  phoneNumberId?: string;
  wabaId?: string;
  displayPhone?: string | null;
  label?: string | null;
  webhookVerifyToken?: string | null;
  /** string vazia = remover; undefined = manter. */
  accessToken?: string | null;
  actorUserId?: string | null;
}): Promise<
  | {
      id: string;
      tenantId: string;
      phoneNumberId: string;
      wabaId: string;
      displayPhone: string | null;
      label: string | null;
    }
  | IntegrationNotFound
  | IntegrationDuplicate
> {
  const db = getDb();
  const [current] = await db
    .select({
      id: whatsappCloudNumbers.id,
      tenantId: whatsappCloudNumbers.tenantId,
      phoneNumberId: whatsappCloudNumbers.phoneNumberId,
      wabaId: whatsappCloudNumbers.wabaId,
      displayPhone: whatsappCloudNumbers.displayPhone,
      label: whatsappCloudNumbers.label,
    })
    .from(whatsappCloudNumbers)
    .where(eq(whatsappCloudNumbers.id, input.id))
    .limit(1);
  if (!current) return { error: "not_found" };

  if (
    input.phoneNumberId !== undefined &&
    input.phoneNumberId.trim() !== current.phoneNumberId
  ) {
    const [conflict] = await db
      .select({ id: whatsappCloudNumbers.id })
      .from(whatsappCloudNumbers)
      .where(
        and(
          eq(whatsappCloudNumbers.tenantId, current.tenantId),
          eq(whatsappCloudNumbers.phoneNumberId, input.phoneNumberId.trim()),
          ne(whatsappCloudNumbers.id, current.id)
        )
      )
      .limit(1);
    if (conflict) return { error: "duplicate_external_id" };
  }

  const updates: Record<string, unknown> = {};
  if (input.phoneNumberId !== undefined) updates.phoneNumberId = input.phoneNumberId.trim();
  if (input.wabaId !== undefined) updates.wabaId = input.wabaId.trim();
  if (input.displayPhone !== undefined) updates.displayPhone = input.displayPhone?.trim() || null;
  if (input.label !== undefined) updates.label = input.label?.trim() || null;
  if (input.webhookVerifyToken !== undefined) {
    updates.webhookVerifyToken = input.webhookVerifyToken?.trim() || null;
  }
  if (input.accessToken !== undefined) {
    updates.accessTokenEncrypted = input.accessToken?.trim()
      ? encryptSecretForStorage(input.accessToken.trim(), "updateWhatsappCloudNumber:accessToken")
      : null;
  }

  if (Object.keys(updates).length === 0) {
    return {
      id: current.id,
      tenantId: current.tenantId,
      phoneNumberId: current.phoneNumberId,
      wabaId: current.wabaId,
      displayPhone: current.displayPhone,
      label: current.label,
    };
  }

  const [updated] = await db
    .update(whatsappCloudNumbers)
    .set(updates as Partial<typeof whatsappCloudNumbers.$inferInsert>)
    .where(eq(whatsappCloudNumbers.id, current.id))
    .returning({
      id: whatsappCloudNumbers.id,
      tenantId: whatsappCloudNumbers.tenantId,
      phoneNumberId: whatsappCloudNumbers.phoneNumberId,
      wabaId: whatsappCloudNumbers.wabaId,
      displayPhone: whatsappCloudNumbers.displayPhone,
      label: whatsappCloudNumbers.label,
    });
  if (!updated) return { error: "not_found" };

  await recordTenantActivity({
    tenantId: updated.tenantId,
    actorUserId: input.actorUserId ?? null,
    scope: "integrations",
    action: "update",
    notificationType: "integration_updated",
    title: "Integração WhatsApp Cloud atualizada",
    message: `Número ${updated.label?.trim() || updated.displayPhone?.trim() || updated.phoneNumberId} foi atualizado.`,
    resourceType: "integration_whatsapp_cloud",
    resourceId: updated.id,
    oldValues: {
      phoneNumberId: current.phoneNumberId,
      wabaId: current.wabaId,
      displayPhone: current.displayPhone,
      label: current.label,
    },
    newValues: {
      phoneNumberId: updated.phoneNumberId,
      wabaId: updated.wabaId,
      displayPhone: updated.displayPhone,
      label: updated.label,
    },
    metadata: { provider: "whatsapp_cloud", integrationId: updated.id },
  });
  return updated;
}
