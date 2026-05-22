import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { getDb } from "@/server/db";
import {
  authConfig,
  authFeatures,
  buildSetCookieHeader,
  buildSetCsrfCookieFromSession,
  createSession,
} from "@/server/auth";
import { isSuperAdmin } from "@/server/tenancy/membership";
import { chooseInitialTenantId } from "@/server/tenancy/choose-initial-tenant";
import { memberships, tenants } from "@/db/schema";
import { exchangeGoogleCodeForUser, readGoogleState } from "@/server/auth/google-oauth";
import { sanitizeOAuthRedirect } from "@/server/security/redirect-policy";
import { runWithRlsContext } from "@/server/db/access-context";

function redirectWithError(request: NextRequest, to: string, code: string) {
  const url = new URL(to, request.url);
  url.searchParams.set("error", code);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  if (!authFeatures.googleLoginEnabled) {
    return redirectWithError(request, "/login", "google_disabled");
  }

  const code = request.nextUrl.searchParams.get("code");
  const stateRaw = request.nextUrl.searchParams.get("state");
  if (!code || !stateRaw) {
    return redirectWithError(request, "/login", "google_invalid");
  }

  const state = readGoogleState(stateRaw);
  if (!state) {
    return redirectWithError(request, "/login", "google_state");
  }

  const fromRaw = typeof state.from === "string" ? state.from : "/dashboard";
  const from = sanitizeOAuthRedirect(fromRaw, "/dashboard", ["/dashboard", "/admin"]);
  const remember = state.remember === true;
  const isAdminFlow = state.isAdmin === true;

  try {
    const oauthUser = await exchangeGoogleCodeForUser(code);
    if (!oauthUser.email_verified) {
      return redirectWithError(request, isAdminFlow ? "/admin-login" : "/login", "google_not_verified");
    }

    return await runWithRlsContext({ tenantId: null, bypassRls: true }, async () => {
      const db = getDb();
      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          isActive: users.isActive,
        })
        .from(users)
        .where(eq(users.email, oauthUser.email.toLowerCase()))
        .limit(1);

      if (!user || !user.isActive) {
        return redirectWithError(request, isAdminFlow ? "/admin-login" : "/login", "google_invite_only");
      }

      if (isAdminFlow) {
        const superAdmin = await isSuperAdmin(user.id);
        if (!superAdmin) {
          return redirectWithError(request, "/admin-login", "google_forbidden");
        }
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

      const ttlSeconds = remember
        ? authConfig.rememberMeTtlSeconds
        : authConfig.defaultSessionTtlSeconds;
      const session = await createSession({
        userId: user.id,
        currentTenantId: initialTenantId,
        ipAddress:
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          request.headers.get("x-real-ip") ??
          null,
        userAgent: request.headers.get("user-agent") ?? null,
        ttlSeconds,
      });

      const target = isAdminFlow ? "/admin" : from;
      const response = NextResponse.redirect(new URL(target, request.url));
      response.headers.append(
        "Set-Cookie",
        buildSetCookieHeader(session.token, { maxAge: session.maxAge })
      );
      response.headers.append("Set-Cookie", buildSetCsrfCookieFromSession());
      return response;
    });
  } catch {
    return redirectWithError(request, isAdminFlow ? "/admin-login" : "/login", "google_failed");
  }
}
