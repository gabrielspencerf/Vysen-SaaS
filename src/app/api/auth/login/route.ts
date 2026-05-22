/**
 * POST /api/auth/login — autenticação por email e senha.
 * Cria sessão, define current_tenant_id inicial, devolve cookie HTTP-only.
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { users, memberships, tenants } from "@/db/schema";
import {
  authConfig,
  authFeatures,
  createSession,
  buildSetCookieHeader,
  buildSetCsrfCookieFromSession,
  hashPassword,
  verifyPassword,
} from "@/server/auth";
import { chooseInitialTenantId } from "@/server/tenancy/choose-initial-tenant";
import { isSuperAdmin } from "@/server/tenancy/membership";
import { checkRateLimit } from "@/server/security/rate-limit";
import { runWithRlsContext } from "@/server/db/access-context";

const GENERIC_ERROR_MESSAGE = "Credenciais inválidas";

// Hash Argon2id de uma senha qualquer ("dummy"). Calculado uma vez no boot, reusado
// no caminho "usuário não existe / inativo" para que o tempo de resposta fique
// próximo do caminho real (verifyPassword) — fechando o oracle de enumeração de
// e-mails. Custos exatos não importam: só precisa que o `verify` chame o KDF.
let DUMMY_HASH: string | null = null;
let dummyHashInflight: Promise<string> | null = null;
async function getDummyHash(): Promise<string> {
  if (DUMMY_HASH) return DUMMY_HASH;
  if (!dummyHashInflight) {
    dummyHashInflight = hashPassword("dummy-not-a-real-secret").then((hash) => {
      DUMMY_HASH = hash;
      return hash;
    });
  }
  return dummyHashInflight;
}

export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string; remember_me?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido" },
      { status: 400 }
    );
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const rememberMe = body.remember_me === true;

  const limiter = await checkRateLimit({
    request,
    bucket: "auth-login",
    max: 10,
    windowSeconds: 15 * 60,
    resourceKey: email || "any",
  });
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas de login. Aguarde e tente novamente." },
      { status: 429 }
    );
  }

  if (!email || !password) {
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 401 });
  }

  return runWithRlsContext({ tenantId: null, bypassRls: true }, async () => {
    const db = getDb();
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user || !user.isActive) {
      // Roda Argon2 contra um hash dummy para que o tempo total se aproxime do
      // caminho real. Sem isso, "email não cadastrado" responde em <10ms e
      // "senha errada" em 50-200ms — vazando enumeração via timing.
      try {
        const dummy = await getDummyHash();
        await verifyPassword(password || "x", dummy);
      } catch {
        // ignore — dummy verification não deve falhar; se falhar, prossegue.
      }
      return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 401 });
    }

    const membershipsWithTenant = await db
      .select({
        tenantId: tenants.id,
        tenantName: tenants.name,
        tenantSlug: tenants.slug,
      })
      .from(memberships)
      .innerJoin(tenants, eq(memberships.tenantId, tenants.id))
      .where(eq(memberships.userId, user.id));

    const initialTenantId = chooseInitialTenantId(membershipsWithTenant);

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      null;
    const userAgent = request.headers.get("user-agent") ?? null;

    const ttlSeconds =
      authFeatures.rememberMeEnabled && rememberMe
        ? authConfig.rememberMeTtlSeconds
        : authConfig.defaultSessionTtlSeconds;

    const session = await createSession({
      userId: user.id,
      currentTenantId: initialTenantId,
      ipAddress,
      userAgent,
      ttlSeconds,
    });

    const superAdmin = await isSuperAdmin(user.id);
    const response = NextResponse.json(
      { ok: true, isSuperAdmin: superAdmin },
      { status: 200 }
    );
    response.headers.append(
      "Set-Cookie",
      buildSetCookieHeader(session.token, { maxAge: session.maxAge })
    );
    response.headers.append("Set-Cookie", buildSetCsrfCookieFromSession());
    return response;
  });
}
