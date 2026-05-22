/**
 * POST /api/auth/logout-all — invalida TODAS as sessões do usuário e limpa
 * cookies do caller. Útil quando o usuário suspeita de comprometimento ou
 * quer revogar acesso em dispositivos perdidos.
 *
 * Diferença para POST /api/auth/logout:
 * - logout: invalida só a sessão deste device.
 * - logout-all: invalida toda sessão do user_id no DB; outros devices
 *   passam a falhar autenticação na próxima request.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  buildClearCookieHeader,
  buildClearCsrfCookie,
  invalidateAllSessionsForUser,
} from "@/server/auth";
import { runWithRlsContext } from "@/server/db/access-context";
import { checkRateLimit } from "@/server/security/rate-limit";

const APP_URL =
  typeof process.env.NEXT_PUBLIC_APP_URL === "string" &&
  process.env.NEXT_PUBLIC_APP_URL.length > 0
    ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
    : null;

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // Rate-limit modesto: usuário legítimo usa raramente. Sob ataque, prefere
  // rejeitar do que invalidar sessões em massa repetidamente.
  const limiter = await checkRateLimit({
    request,
    bucket: "auth:logout-all",
    max: 5,
    windowSeconds: 60,
    resourceKey: session.user.id,
  });
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde e tente novamente." },
      {
        status: 429,
        headers: { "Retry-After": String(limiter.retryAfterSeconds) },
      }
    );
  }

  await runWithRlsContext({ tenantId: null, bypassRls: true }, async () =>
    invalidateAllSessionsForUser(session.user.id)
  );

  const baseUrl = APP_URL ?? request.nextUrl.origin;
  const loginUrl = new URL("/login", baseUrl);
  const response = NextResponse.redirect(loginUrl, 302);
  response.headers.append("Set-Cookie", buildClearCookieHeader());
  response.headers.append("Set-Cookie", buildClearCsrfCookie());
  return response;
}
