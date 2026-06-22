const PII_SENTINEL = "[redacted]";

/** Chaves comuns em payloads de messaging (minúsculas para comparação). */
const EXACT_REDACT_KEYS = new Set([
  "phone",
  "phonenumber",
  "wa_id",
  "waid",
  "name",
  "pushname",
  "verifiedname",
  "text",
  "body",
  "content",
  "caption",
  "message",
  "email",
  "address",
  "profilepicurl",
  "profile_picture",
]);

function shouldRedactKey(key: string): boolean {
  const k = key.toLowerCase();
  if (EXACT_REDACT_KEYS.has(k)) return true;
  if (k.includes("phone") || k.includes("telefone")) return true;
  return false;
}

function anonymizeNode(key: string, value: unknown, depth: number): unknown {
  if (depth > 14) {
    return PII_SENTINEL;
  }
  if (shouldRedactKey(key)) {
    if (value === null || value === undefined) return value;
    if (typeof value === "object") return { __redacted: true };
    return PII_SENTINEL;
  }
  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === "object" && item !== null
        ? anonymizeUnknown(item, depth + 1)
        : item
    );
  }
  if (value && typeof value === "object") {
    return anonymizeUnknown(value, depth + 1);
  }
  return value;
}

function anonymizeUnknown(obj: object, depth: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = anonymizeNode(k, v, depth + 1);
  }
  return out;
}

/**
 * Preserva estrutura/contadores úteis para analytics; remove PII explícito.
 */
export function anonymizeWebhookPayloadForRetention(
  payload: unknown
): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const base = payload as Record<string, unknown>;
    if (base.__pii_redacted === true) {
      return base;
    }
    return { ...anonymizeUnknown(base, 0), __pii_redacted: true };
  }
  return { __pii_redacted: true, _legacy: true };
}
