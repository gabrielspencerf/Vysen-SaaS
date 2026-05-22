import { createHmac, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { env } from "@/config/env";
import { getDb } from "@/server/db";
import { chatwootAccounts } from "@/db/schema";
import { tryDecryptStoredSecret } from "@/server/security/secret-storage";

export interface ChatwootWebhookContext {
  tenantId: string;
  chatwootAccountId: string;
}

function verifyHmac(secret: string, rawBody: string, signature: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const provided = signature.replace(/^sha256=/, "").toLowerCase().trim();
  if (!provided) return false;
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function validateChatwootWebhook(
  request: Request,
  accountId: string,
  rawBody: string
): Promise<ChatwootWebhookContext | { error: string; status: number }> {
  const trimmed = accountId.trim();
  if (!trimmed) {
    return { error: "Account identifier required", status: 400 };
  }

  const db = getDb();
  const [account] = await db
    .select({
      id: chatwootAccounts.id,
      tenantId: chatwootAccounts.tenantId,
      apiTokenEncrypted: chatwootAccounts.apiTokenEncrypted,
    })
    .from(chatwootAccounts)
    .where(eq(chatwootAccounts.id, trimmed))
    .limit(1);

  if (!account) {
    return { error: "Account not found", status: 404 };
  }

  const webhookSecret = tryDecryptStoredSecret(
    account.apiTokenEncrypted,
    `chatwoot_accounts.api_token:${account.id}`
  );
  if (env.isProduction && !webhookSecret?.trim()) {
    return {
      error: "Conta sem token configurado para validação HMAC do webhook",
      status: 503,
    };
  }

  if (webhookSecret?.trim()) {
    const signature = request.headers.get("x-chatwoot-signature") ?? "";
    if (!signature || !verifyHmac(webhookSecret.trim(), rawBody, signature)) {
      return { error: "Assinatura inválida", status: 403 };
    }
  }

  return {
    tenantId: account.tenantId,
    chatwootAccountId: account.id,
  };
}
