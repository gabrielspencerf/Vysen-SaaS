/**
 * Lógica de troca de tenant: validar membership e rotacionar a sessão.
 */
import { rotateSessionTenant } from "@/server/auth";
import { canAssumeTenant } from "./membership";

export interface SwitchTenantResult {
  ok: boolean;
  error?: "forbidden" | "not_found" | "session_lost";
  // Quando ok=true, o caller deve setar Set-Cookie com o novo token e CSRF.
  token?: string;
  maxAge?: number;
}

/**
 * Troca o tenant atual da sessão se o usuário tiver membership no tenant.
 *
 * **Rotaciona o token** de sessão (emite novo, invalida o antigo) para evitar
 * que um cookie capturado pré-troca continue válido após escalada de privilégio.
 */
export async function switchTenant(
  sessionId: string,
  userId: string,
  tenantId: string
): Promise<SwitchTenantResult> {
  const allowed = await canAssumeTenant(userId, tenantId);
  if (!allowed) {
    return { ok: false, error: "forbidden" };
  }
  const rotated = await rotateSessionTenant(sessionId, tenantId);
  if (!rotated) {
    return { ok: false, error: "session_lost" };
  }
  return { ok: true, token: rotated.token, maxAge: rotated.maxAge };
}
