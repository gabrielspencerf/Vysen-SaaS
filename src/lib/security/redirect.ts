export type SanitizeRedirectOptions = {
  /**
   * Quando true, aceita qualquer caminho relativo seguro (/, sem //, sem esquema, sem ..).
   * Usado no servidor com `SECURITY_STRICT_REDIRECTS=false` para rollout gradual.
   */
  relaxed?: boolean;
};

export function sanitizeInternalRedirect(
  candidate: string | null | undefined,
  fallback: string,
  allowedPrefixes: string[] = ["/dashboard", "/admin", "/"],
  options?: SanitizeRedirectOptions
): string {
  if (!candidate) return fallback;
  const value = candidate.trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("://")) return fallback;
  if (value.includes("..")) return fallback;
  if (value.includes("\\")) return fallback;
  if (options?.relaxed) {
    return value;
  }
  if (!allowedPrefixes.some((prefix) => value === prefix || value.startsWith(`${prefix}/`))) {
    return fallback;
  }
  return value;
}
