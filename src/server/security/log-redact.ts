/**
 * Redação leve para logs (não substitui mascaramento no armazenamento).
 *
 * Cobre os vetores de vazamento mais comuns em logs estruturados / stack traces:
 * telefones, e-mails, tokens estilo OpenAI/Stripe (`sk-...`), bearer tokens em
 * header, e JWTs em URLs ou bodies.
 *
 * Use `redactSensitiveLog(text)` antes de logar qualquer string vinda de payload,
 * preview, mensagem de erro de provedor externo, etc.
 */

const PHONE_RE = /\+?\d[\d\s().-]{8,}\d/g;
// E-mail RFC-ish — pega 99% dos casos comuns sem ser perfeito.
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// Chaves estilo OpenAI/Stripe/SendGrid/etc — prefixo `sk-` + >= 20 chars.
const SK_TOKEN_RE = /\bsk-[A-Za-z0-9_-]{20,}\b/g;
// "Authorization: Bearer <token>" ou trecho similar.
const BEARER_RE = /bearer\s+[A-Za-z0-9._\-+/=]{8,}/gi;
// JWT: três segmentos base64url separados por ponto.
const JWT_RE = /\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
// Query string param sensível (token / api_key / access_token / apikey).
const QUERY_SECRET_RE = /\b(api[_-]?key|access[_-]?token|token|apikey)=([^&\s"']+)/gi;

export function redactLikelyPhoneSequences(text: string): string {
  return text.replace(PHONE_RE, "[phone]");
}

export function redactEmails(text: string): string {
  return text.replace(EMAIL_RE, "[email]");
}

export function redactSkTokens(text: string): string {
  return text.replace(SK_TOKEN_RE, "[sk-redacted]");
}

export function redactBearerTokens(text: string): string {
  return text.replace(BEARER_RE, "Bearer [redacted]");
}

export function redactJwt(text: string): string {
  return text.replace(JWT_RE, "[jwt]");
}

export function redactQuerySecrets(text: string): string {
  return text.replace(QUERY_SECRET_RE, "$1=[redacted]");
}

/**
 * Aplica todas as redações em ordem. Sempre prefira esta função em logs de
 * payload bruto (webhooks, bodies externos, stack traces de integrações).
 */
export function redactSensitiveLog(text: string): string {
  let out = text;
  // JWT precisa vir antes de sk-* porque um JWT pode começar com base64 que
  // parece com token genérico; ordem importa pra não duplicar substituição.
  out = redactJwt(out);
  out = redactBearerTokens(out);
  out = redactSkTokens(out);
  out = redactQuerySecrets(out);
  out = redactEmails(out);
  out = redactLikelyPhoneSequences(out);
  return out;
}

/**
 * Scrub de segredos em input do usuário ANTES de enviar a um modelo LLM externo.
 * Diferente de `redactSensitiveLog`, NÃO redige email/telefone (são dados de
 * trabalho legítimos da plataforma — o usuário pode perguntar sobre eles).
 * Foca em: tokens estilo sk-*, JWT, Bearer header, query string secrets.
 */
export function scrubSecretsForLlm(text: string): string {
  let out = text;
  out = redactJwt(out);
  out = redactBearerTokens(out);
  out = redactSkTokens(out);
  out = redactQuerySecrets(out);
  return out;
}
