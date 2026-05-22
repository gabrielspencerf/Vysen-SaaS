import { createHmac, timingSafeEqual } from "node:crypto";

export interface GoogleOAuthUser {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
}

function b64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromB64url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function stateSecret(): string {
  const secret = process.env.GOOGLE_AUTH_STATE_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    // Lançar é o comportamento correto: state HMAC com segredo previsível ("fallback")
    // permite forjar state arbitrário, anulando a proteção CSRF do OAuth.
    throw new Error(
      "Segredo de state do Google OAuth ausente: defina GOOGLE_AUTH_STATE_SECRET ou SESSION_SECRET."
    );
  }
  return secret;
}

export function createGoogleState(payload: Record<string, unknown>): string {
  const serialized = JSON.stringify({
    ...payload,
    ts: Date.now(),
  });
  const encoded = b64url(serialized);
  const sig = createHmac("sha256", stateSecret()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function readGoogleState(state: string): Record<string, unknown> | null {
  const [encoded, sig] = state.split(".");
  if (!encoded || !sig) return null;
  const expected = createHmac("sha256", stateSecret()).update(encoded).digest("base64url");
  const sigBuffer = Buffer.from(sig);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(sigBuffer, expectedBuffer)) return null;
  try {
    const parsed = JSON.parse(fromB64url(encoded)) as Record<string, unknown>;
    const ts = typeof parsed.ts === "number" ? parsed.ts : 0;
    if (!ts || Date.now() - ts > 15 * 60 * 1000) return null; // 15 min
    return parsed;
  } catch {
    return null;
  }
}

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Variável ausente: ${key}`);
  return value;
}

function resolveRedirectUri(): string {
  const explicit = process.env.GOOGLE_AUTH_REDIRECT_URI;
  if (explicit) return explicit;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL ausente para Google OAuth.");
  return `${appUrl.replace(/\/$/, "")}/api/auth/google/callback`;
}

export function buildGoogleAuthUrl(state: string): string {
  const clientId = required("GOOGLE_AUTH_CLIENT_ID");
  const redirectUri = resolveRedirectUri();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCodeForUser(code: string): Promise<GoogleOAuthUser> {
  const clientId = required("GOOGLE_AUTH_CLIENT_ID");
  const clientSecret = required("GOOGLE_AUTH_CLIENT_SECRET");
  const redirectUri = resolveRedirectUri();

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) {
    throw new Error(`Falha no token Google (${tokenResponse.status})`);
  }
  const tokenData = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenData.access_token) throw new Error("Google não retornou access_token.");

  const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!userInfoResponse.ok) {
    throw new Error(`Falha no userinfo Google (${userInfoResponse.status})`);
  }
  const user = (await userInfoResponse.json()) as GoogleOAuthUser;
  if (!user.email) throw new Error("Conta Google sem e-mail.");
  return user;
}
