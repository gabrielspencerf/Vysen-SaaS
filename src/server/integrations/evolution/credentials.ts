import { eq } from "drizzle-orm";
import { evolutionInstances } from "@/db/schema";
import { getDb } from "@/server/db";
import { tryDecryptStoredSecret } from "@/server/security/secret-storage";

export async function getEvolutionInstanceSecret(
  evolutionInstanceId: string
): Promise<string | null> {
  const db = getDb();
  const [instance] = await db
    .select({ apiKeyEncrypted: evolutionInstances.apiKeyEncrypted })
    .from(evolutionInstances)
    .where(eq(evolutionInstances.id, evolutionInstanceId))
    .limit(1);

  return tryDecryptStoredSecret(
    instance?.apiKeyEncrypted ?? null,
    `evolution_instances.api_key:${evolutionInstanceId}`
  );
}
