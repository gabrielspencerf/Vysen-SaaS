/**
 * Resolve SMTP config efetiva para envio de e-mail.
 *
 * Estratégia:
 *  1. Se `tenantId` informado e há config tenant ativa, usa-a;
 *  2. Senão, cai no SMTP global definido por variáveis de ambiente.
 *
 * Quem chama `sendEmail` decide se passa `tenantId`. Auth flows
 * (password reset / acesso inicial) hoje seguem global por não terem
 * contexto de tenant claro — quando passar a propagar `tenantId`, a
 * resolução já estará pronta.
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { tenantSmtpConfigs } from "@/db/schema";
import { tryDecryptStoredSecret } from "@/server/security/secret-storage";
import { runWithRlsContext } from "@/server/db/access-context";

export interface ResolvedSmtpConfig {
  source: "tenant" | "env";
  enabled: boolean;
  host: string | undefined;
  port: number;
  user: string | undefined;
  pass: string | undefined;
  secure: boolean;
  from: string;
  fromName?: string | null;
  replyTo: string | undefined;
  requireTls: boolean;
  authMethod: string | undefined;
}

function loadEnvConfig(): ResolvedSmtpConfig {
  const host = process.env.SMTP_HOST || process.env.SMTP_ADDRESS;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER || process.env.SMTP_USERNAME;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  const secure =
    process.env.SMTP_SECURE === "true" ||
    process.env.SMTP_SSL === "true" ||
    port === 465;
  const from =
    process.env.SMTP_FROM ||
    process.env.MAILER_SENDER_EMAIL ||
    "hub@creativelane.io";
  const replyTo =
    process.env.SMTP_REPLY_TO ||
    process.env.MAILER_INBOUND_EMAIL_DOMAIN ||
    undefined;
  const requireTls = process.env.SMTP_ENABLE_STARTTLS_AUTO === "true";
  const authMethod = process.env.SMTP_AUTHENTICATION || undefined;
  const enabled = process.env.SMTP_ENABLED === "true";

  return {
    source: "env",
    enabled,
    host,
    port,
    user,
    pass,
    secure,
    from,
    fromName: null,
    replyTo,
    requireTls,
    authMethod,
  };
}

export async function resolveSmtpConfig(
  tenantId?: string | null
): Promise<ResolvedSmtpConfig> {
  if (!tenantId) return loadEnvConfig();

  let row: typeof tenantSmtpConfigs.$inferSelect | undefined;
  try {
    row = await runWithRlsContext({ tenantId: null, bypassRls: true }, async () => {
      const db = getDb();
      const [first] = await db
        .select()
        .from(tenantSmtpConfigs)
        .where(eq(tenantSmtpConfigs.tenantId, tenantId))
        .limit(1);
      return first;
    });
  } catch {
    return loadEnvConfig();
  }

  if (!row || !row.enabled) return loadEnvConfig();

  let pass: string | undefined;
  if (row.passwordEncrypted) {
    const decrypted = tryDecryptStoredSecret(
      row.passwordEncrypted,
      "smtp.password"
    );
    if (!decrypted) {
      // Decrypt falhou (logged em tryDecryptStoredSecret) — cai pro env.
      return loadEnvConfig();
    }
    pass = decrypted;
  }

  const fromValue =
    row.fromName?.trim() ? `${row.fromName.trim()} <${row.fromEmail}>` : row.fromEmail;

  return {
    source: "tenant",
    enabled: true,
    host: row.host,
    port: row.port,
    user: row.username ?? undefined,
    pass,
    secure: row.secure,
    from: fromValue,
    fromName: row.fromName,
    replyTo: row.replyTo ?? undefined,
    requireTls: row.requireTls,
    authMethod: undefined,
  };
}
