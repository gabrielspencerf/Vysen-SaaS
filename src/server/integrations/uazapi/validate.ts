/**
 * Validar request webhook UAZAPI: identificar instance + tenant pela URL.
 * instanceId na URL = uazapi_instances.id (UUID). Paridade com Evolution.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { uazapiInstances } from "@/db/schema";

export interface UazapiWebhookContext {
  tenantId: string;
  uazapiInstanceId: string;
}

export async function validateUazapiWebhook(
  instanceIdOrToken: string
): Promise<UazapiWebhookContext | { error: string; status: number }> {
  const trimmed = instanceIdOrToken.trim();
  if (!trimmed) {
    return { error: "Instance identifier required", status: 400 };
  }

  const db = getDb();
  const [instance] = await db
    .select({
      id: uazapiInstances.id,
      tenantId: uazapiInstances.tenantId,
    })
    .from(uazapiInstances)
    .where(eq(uazapiInstances.id, trimmed))
    .limit(1);

  if (!instance) {
    return { error: "Instance not found", status: 404 };
  }

  return {
    tenantId: instance.tenantId,
    uazapiInstanceId: instance.id,
  };
}
