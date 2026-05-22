/**
 * Criação, leitura e invalidação de sessão (tabela sessions).
 * Token opaco no cookie; apenas token_hash no banco.
 */
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/server/db";
import { sessions, users, tenants } from "@/db/schema";
import { authConfig } from "./config";
import { hashToken, generateOpaqueToken } from "./token";
import {
  buildClearCsrfCookieHeader,
  buildSetCsrfCookieHeader,
  generateCsrfToken,
} from "@/server/security/csrf";

const SESSION_COOKIE_NAME = authConfig.cookieName;

function getCookieFromRequest(request: Request | null, name: string): string | null {
  if (!request) return null;
  const header = request.headers.get("cookie");
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1].trim()) : null;
}

export interface SessionWithUserAndTenant {
  session: {
    id: string;
    userId: string;
    currentTenantId: string | null;
    expiresAt: Date;
  };
  user: {
    id: string;
    email: string;
    name: string | null;
    isActive: boolean;
  };
  tenant: { id: string; name: string; slug: string } | null;
}

export interface CreateSessionParams {
  userId: string;
  currentTenantId: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  ttlSeconds?: number;
}

/**
 * Cria sessão no banco e retorna o token opaco (para o caller setar o cookie).
 */
export async function createSession(params: CreateSessionParams): Promise<{ token: string; maxAge: number }> {
  const db = getDb();
  const token = generateOpaqueToken();
  const tokenHash = hashToken(token);
  const now = new Date();
  const ttlSeconds = Math.max(60, params.ttlSeconds ?? authConfig.defaultSessionTtlSeconds);
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  await db.insert(sessions).values({
    userId: params.userId,
    currentTenantId: params.currentTenantId,
    tokenHash,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
    expiresAt,
    lastActivityAt: now,
  });

  return { token, maxAge: ttlSeconds };
}

/**
 * Busca sessão a partir do cookie da request; verifica expires_at; opcionalmente atualiza last_activity_at.
 * Retorna null se cookie ausente, token inválido ou sessão expirada.
 */
export async function getSessionFromCookie(
  request: Request | null,
  options?: { updateActivity?: boolean }
): Promise<SessionWithUserAndTenant | null> {
  if (!request) return null;
  const token = getCookieFromRequest(request, SESSION_COOKIE_NAME);
  if (!token) return null;

  const db = getDb();
  const tokenHash = hashToken(token);
  const now = new Date();

  const [row] = await db
    .select({
      sessionId: sessions.id,
      userId: sessions.userId,
      currentTenantId: sessions.currentTenantId,
      expiresAt: sessions.expiresAt,
      lastActivityAt: sessions.lastActivityAt,
    })
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1);

  if (!row) return null;

  if (options?.updateActivity) {
    await db
      .update(sessions)
      .set({ lastActivityAt: now })
      .where(eq(sessions.id, row.sessionId));
  }

  const [userRow] = await db
    .select({ id: users.id, email: users.email, name: users.name, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1);

  if (!userRow || !userRow.isActive) return null;

  let tenant: SessionWithUserAndTenant["tenant"] = null;
  if (row.currentTenantId) {
    const [tenantRow] = await db
      .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
      .from(tenants)
      .where(eq(tenants.id, row.currentTenantId))
      .limit(1);
    if (tenantRow) tenant = tenantRow;
  }

  return {
    session: {
      id: row.sessionId,
      userId: row.userId,
      currentTenantId: row.currentTenantId,
      expiresAt: row.expiresAt,
    },
    user: {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      isActive: userRow.isActive,
    },
    tenant,
  };
}

/**
 * Atualiza o current_tenant_id da sessão (troca de tenant). Não cria nova sessão.
 *
 * @deprecated Para troca de tenant prefira rotateSessionTenant, que emite um novo
 * token. Manter current_tenant_id num token herdado mantém cookie pré-troca válido
 * em outro dispositivo após escalada de privilégio.
 */
export async function updateSessionTenant(
  sessionId: string,
  tenantId: string | null
): Promise<void> {
  const db = getDb();
  await db
    .update(sessions)
    .set({ currentTenantId: tenantId, lastActivityAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

/**
 * Troca o tenant da sessão emitindo um novo token e invalidando a sessão antiga.
 * Preserva o TTL restante. Caller deve setar Set-Cookie com o novo token.
 *
 * Retorna null se a sessão original não existir.
 */
export async function rotateSessionTenant(
  oldSessionId: string,
  newTenantId: string | null
): Promise<{ token: string; maxAge: number } | null> {
  const db = getDb();
  const [row] = await db
    .select({
      userId: sessions.userId,
      ipAddress: sessions.ipAddress,
      userAgent: sessions.userAgent,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(eq(sessions.id, oldSessionId))
    .limit(1);
  if (!row) return null;

  const now = new Date();
  const remainingMs = row.expiresAt.getTime() - now.getTime();
  const ttlSeconds = Math.max(60, Math.floor(remainingMs / 1000));

  const fresh = await createSession({
    userId: row.userId,
    currentTenantId: newTenantId,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    ttlSeconds,
  });
  await invalidateSession(oldSessionId);
  return fresh;
}

/**
 * Invalida a sessão atual (remove do banco). Usar antes de limpar o cookie no logout.
 */
export async function invalidateSession(sessionId: string): Promise<void> {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/**
 * Invalida a sessão associada ao cookie da request (se existir).
 */
export async function invalidateCurrent(request: Request | null): Promise<boolean> {
  const data = await getSessionFromCookie(request, { updateActivity: false });
  if (!data) return false;
  await invalidateSession(data.session.id);
  return true;
}

/**
 * Invalida todas as sessões do usuário (para uso futuro: "sair de todos os dispositivos").
 */
export async function invalidateAllSessionsForUser(userId: string): Promise<void> {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * Monta o header Set-Cookie para a sessão (login).
 */
export function buildSetCookieHeader(token: string, options?: { maxAge?: number }): string {
  const opts = authConfig.cookieOptions;
  const maxAge = options?.maxAge ?? opts.maxAge;
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    opts.secure ? "Secure" : "",
    `SameSite=${opts.sameSite}`,
    `Path=${opts.path}`,
    `Max-Age=${maxAge}`,
  ].filter(Boolean);
  return parts.join("; ");
}

/**
 * Monta o header Set-Cookie para limpar o cookie (logout).
 *
 * IMPORTANTE: replica Secure/SameSite/Path do set; navegadores estritos rejeitam
 * substituir um cookie Secure por non-Secure, o que deixaria o cookie original
 * ativo após logout.
 */
export function buildClearCookieHeader(): string {
  const opts = authConfig.cookieOptions;
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    `Path=${opts.path}`,
    "HttpOnly",
    opts.secure ? "Secure" : "",
    `SameSite=${opts.sameSite}`,
    "Max-Age=0",
  ].filter(Boolean);
  return parts.join("; ");
}

export function buildSetCsrfCookieFromSession(): string {
  return buildSetCsrfCookieHeader(generateCsrfToken());
}

export function buildClearCsrfCookie(): string {
  return buildClearCsrfCookieHeader();
}
