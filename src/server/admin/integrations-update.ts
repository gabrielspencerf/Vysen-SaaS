/**
 * Leitura e atualização de integrações (Evolution e UAZAPI) por id.
 * Chamador deve usar requireAdmin na camada de rota.
 */
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/server/db";
import { evolutionInstances, uazapiInstances } from "@/db/schema";
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
