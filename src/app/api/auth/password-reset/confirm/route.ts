import { NextRequest, NextResponse } from "next/server";
import { authFeatures } from "@/server/auth";
import { checkRateLimit } from "@/server/security/rate-limit";
import { resetPasswordByToken } from "@/server/auth/password-reset";

export async function POST(request: NextRequest) {
  if (!authFeatures.passwordResetEnabled) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  // Sem rate-limit aqui, um atacante poderia tentar adivinhar tokens
  // (256 bits são improváveis de bruteforce, mas tokens leakados por logs / canais
  // laterais podem ser testados em paralelo). 10 tentativas / 15min por IP é folgado
  // para o usuário legítimo.
  const limiter = await checkRateLimit({
    request,
    bucket: "auth-password-reset-confirm",
    max: 10,
    windowSeconds: 15 * 60,
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

  let body: { token?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";
  const result = await resetPasswordByToken({ token, newPassword: password });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
