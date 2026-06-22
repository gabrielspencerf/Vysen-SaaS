import { encryptSecret, decryptSecret } from "@/server/security/secret-crypto";
import { env } from "@/config/env";

function isEncryptionConfigError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message || "";
  return (
    message.includes("INTEGRATIONS_ENCRYPTION_KEY") ||
    message.includes("CONFIG_ENCRYPTION_KEY") ||
    message.includes("Chave inválida")
  );
}

/**
 * Em desenvolvimento/teste, permite fallback para plain-text quando a chave de
 * criptografia não está configurada. Em produção, mantém fail-fast por segurança.
 */
export function encryptSecretForStorage(secret: string, _source: string): string {
  try {
    return encryptSecret(secret);
  } catch (error) {
    const isConfigError = isEncryptionConfigError(error);
    const canFallback =
      !env.isProduction &&
      env.isDev &&
      env.securityAllowPlaintextSecrets &&
      isConfigError;

    if (canFallback) {
      return secret;
    }
    throw error;
  }
}

/**
 * Decifra um segredo armazenado. Se a decifragem falhar:
 * - em dev com SECURITY_ALLOW_PLAINTEXT_SECRETS=true, assume que o valor é
 *   plaintext legado e retorna como está (mantém compatibilidade de migração);
 * - caso contrário, retorna `null` e loga error — bloqueia uso do valor e força
 *   investigação (chave rotacionada, payload corrompido, key mismatch).
 *
 * NUNCA retorna o ciphertext bruto como se fosse o segredo válido.
 */
export function tryDecryptStoredSecret(
  value: string | null | undefined,
  context: string
): string | null {
  if (!value) return null;
  try {
    return decryptSecret(value);
  } catch (error) {
    const allowLegacyPlaintext =
      !env.isProduction && env.isDev && env.securityAllowPlaintextSecrets;
    if (allowLegacyPlaintext) {
      return value;
    }
    console.error(
      `[secret-storage] Falha ao decifrar segredo (${context}); uso bloqueado. ` +
        `Verifique INTEGRATIONS_ENCRYPTION_KEY / rotação de chave.`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}
