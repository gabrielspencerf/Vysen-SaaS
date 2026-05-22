import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { typebotBots } from "@/db/schema";
import { tryDecryptStoredSecret } from "@/server/security/secret-storage";

export interface TypebotBotCredentials {
  webhookSecret: string | null;
  apiToken: string | null;
  metricsApiBaseUrl: string | null;
}

export async function getTypebotBotCredentials(
  typebotBotId: string
): Promise<TypebotBotCredentials | null> {
  const db = getDb();
  const [bot] = await db
    .select({
      webhookSecretEncrypted: typebotBots.webhookSecretEncrypted,
      apiTokenEncrypted: typebotBots.apiTokenEncrypted,
      metricsApiBaseUrl: typebotBots.metricsApiBaseUrl,
    })
    .from(typebotBots)
    .where(eq(typebotBots.id, typebotBotId))
    .limit(1);

  if (!bot) return null;
  return {
    webhookSecret: tryDecryptStoredSecret(
      bot.webhookSecretEncrypted,
      `typebot_bots.webhook_secret:${typebotBotId}`
    ),
    apiToken: tryDecryptStoredSecret(
      bot.apiTokenEncrypted,
      `typebot_bots.api_token:${typebotBotId}`
    ),
    metricsApiBaseUrl: bot.metricsApiBaseUrl?.trim() || null,
  };
}
