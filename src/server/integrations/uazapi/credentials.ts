import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { uazapiInstances } from "@/db/schema";
import { tryDecryptStoredSecret } from "@/server/security/secret-storage";

function resolveSecret(
  encrypted: string | null,
  field: string,
  instanceId: string
): string | null {
  return tryDecryptStoredSecret(encrypted, `uazapi_instances.${field}:${instanceId}`);
}

export interface UazapiInstanceCredentials {
  apiKey: string | null;
  token: string | null;
  adminToken: string | null;
}

export async function getUazapiInstanceCredentials(
  uazapiInstanceId: string
): Promise<UazapiInstanceCredentials> {
  const db = getDb();
  let instance:
    | {
        apiKeyEncrypted: string | null;
        tokenEncrypted: string | null;
        adminTokenEncrypted: string | null;
      }
    | undefined;
  try {
    [instance] = await db
      .select({
        apiKeyEncrypted: uazapiInstances.apiKeyEncrypted,
        tokenEncrypted: uazapiInstances.tokenEncrypted,
        adminTokenEncrypted: uazapiInstances.adminTokenEncrypted,
      })
      .from(uazapiInstances)
      .where(eq(uazapiInstances.id, uazapiInstanceId))
      .limit(1);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const missingTokenCol =
      message.includes('coluna "token_encrypted"') || message.includes('column "token_encrypted"');
    if (!missingTokenCol) {
      throw err;
    }
    const [legacyInstance] = await db
      .select({
        apiKeyEncrypted: uazapiInstances.apiKeyEncrypted,
      })
      .from(uazapiInstances)
      .where(eq(uazapiInstances.id, uazapiInstanceId))
      .limit(1);
    instance = {
      apiKeyEncrypted: legacyInstance?.apiKeyEncrypted ?? null,
      tokenEncrypted: null,
      adminTokenEncrypted: null,
    };
  }

  return {
    apiKey: resolveSecret(instance?.apiKeyEncrypted ?? null, "api_key", uazapiInstanceId),
    token: resolveSecret(instance?.tokenEncrypted ?? null, "token", uazapiInstanceId),
    adminToken: resolveSecret(
      instance?.adminTokenEncrypted ?? null,
      "admin_token",
      uazapiInstanceId
    ),
  };
}

export async function getUazapiInstanceSecret(
  uazapiInstanceId: string
): Promise<string | null> {
  const credentials = await getUazapiInstanceCredentials(uazapiInstanceId);
  return (
    credentials.apiKey ?? credentials.token ?? credentials.adminToken ?? null
  );
}
