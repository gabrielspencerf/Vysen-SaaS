/**
 * Protecao basica de rotas: exige cookie de sessao em /dashboard, /admin e /superadmin.
 * Rotas publicas: /, /login, /api/auth/*, /api/health.
 * Nao valida o conteudo da sessao; a validacao real acontece nos layouts e APIs.
 */
import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "session";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/admin-login",
  "/forbidden",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session",
  "/api/auth/google/start",
  "/api/auth/google/callback",
  "/api/auth/password-reset/request",
  "/api/auth/password-reset/confirm",
  "/api/health",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/api/auth/") || pathname === "/api/health") return true;
  return false;
}

function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.has(SESSION_COOKIE_NAME);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/dashboard")) {
    if (!hasSessionCookie(request)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/superadmin")) {
    if (!hasSessionCookie(request)) {
      return NextResponse.redirect(new URL("/admin-login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
