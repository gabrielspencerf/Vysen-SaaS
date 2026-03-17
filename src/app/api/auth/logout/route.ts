/**
 * POST /api/auth/logout — invalida a sessão atual, limpa o cookie e redireciona para /login.
 * Usa NEXT_PUBLIC_APP_URL para evitar redirect para host interno (0.0.0.0, localhost do container).
 */
import { NextRequest, NextResponse } from "next/server";
import { invalidateCurrent, buildClearCookieHeader } from "@/server/auth";

const APP_URL =
  typeof process.env.NEXT_PUBLIC_APP_URL === "string" &&
  process.env.NEXT_PUBLIC_APP_URL.length > 0
    ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
    : null;

export async function POST(request: NextRequest) {
  await invalidateCurrent(request);
  const baseUrl = APP_URL ?? request.nextUrl.origin;
  const loginUrl = new URL("/login", baseUrl);
  const response = NextResponse.redirect(loginUrl, 302);
  response.headers.set("Set-Cookie", buildClearCookieHeader());
  return response;
}
