"use client";

/**
 * Página de acesso do administrador: login apenas para super_admin.
 * Após login, redireciona para /superadmin (hub técnico) só se o usuário
 * for super_admin global. Não confundir com /admin (que é "Admin da empresa"
 * — visão de carteira, escopo company-admin).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { ArrowRight, Lock, ShieldAlert } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const googleEnabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE_LOGIN_ENABLED === "true";
  const rememberEnabled = process.env.NEXT_PUBLIC_AUTH_REMEMBER_ME_ENABLED === "true";
  const [oauthError, setOauthError] = useState<string | null>(null);
  const oauthErrorMessage =
    oauthError === "google_forbidden"
      ? "Sua conta Google não é super admin."
      : oauthError === "google_invite_only"
        ? "Sua conta Google não está cadastrada na plataforma."
        : oauthError
          ? "Falha no login Google."
          : null;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOauthError(params.get("error"));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember_me: rememberMe }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Falha no login. Tente novamente.");
        return;
      }
      if (data.isSuperAdmin) {
        // Super_admin entra pelo hub técnico consolidado em /superadmin
        // (NÃO /admin, que é o "Admin da empresa" — visão de carteira).
        router.push("/superadmin");
        router.refresh();
      } else {
        setError("Acesso restrito a administradores. Use credenciais de super admin.");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-4 bg-brand-dark overflow-hidden">
      {/* Imagem de Fundo (Minimalista / Radial Admin) */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(circle at 50% 0%, rgba(239, 68, 68, 0.8) 0%, transparent 60%)"
        }}
      ></div>

      <div className="relative z-10 w-full max-w-md">
        {/* Card Minimalista */}
        <div className="bg-brand-surface p-8 rounded-[24px] shadow-soft-lg animate-fade-in border border-brand-border/60 relative overflow-hidden">

          <div className="flex flex-col items-center mb-8">
            <BrandMark size="lg" className="mb-4" />
            <h1 className="text-2xl font-bold text-brand-text tracking-tight font-display">
              Acesso Restrito
            </h1>
            <p className="mt-2 text-sm text-brand-muted text-center">
              Acesso exclusivo para Super Admin.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div
                role="alert"
                className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-500 border border-red-500/20 flex items-center gap-2"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                {error}
              </div>
            )}
            {oauthErrorMessage && !error && (
              <div className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-400 border border-amber-500/20">
                {oauthErrorMessage}
              </div>
            )}
            <div className="space-y-1.5 relative">
              <label
                htmlFor="admin-email"
                className="block text-xs font-semibold uppercase tracking-wider text-brand-muted ml-1"
              >
                Identificação Admin
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <ShieldAlert className="h-4 w-4 text-brand-muted" />
                </div>
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@vysen.com.br"
                  className="pl-10 bg-brand-dark/50 border-brand-border/60 focus:bg-brand-surface focus:border-red-500/50 focus:ring-red-500/30 transition-all"
                />
              </div>
            </div>
            <div className="space-y-1.5 relative">
              <label
                htmlFor="admin-password"
                className="block text-xs font-semibold uppercase tracking-wider text-brand-muted ml-1"
              >
                Chave Mestra
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-brand-muted" />
                </div>
                <Input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="pl-10 bg-brand-dark/50 border-brand-border/60 focus:bg-brand-surface focus:border-red-500/50 focus:ring-red-500/30 transition-all"
                />
              </div>
            </div>
            {rememberEnabled && (
              <label className="flex items-center gap-2 text-sm text-brand-muted">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-brand-border bg-brand-surface text-brand-neon focus:ring-brand-neon"
                />
                Lembrar de mim neste dispositivo
              </label>
            )}
            <Button 
              type="submit" 
              disabled={loading} 
              className="w-full mt-6 h-12 text-[15px] group bg-red-600 hover:bg-red-700 text-white shadow-[0_4px_15px_-3px_rgba(239,68,68,0.5)] border-red-500/50"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                  Verificando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Acessar Sistema
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </Button>
            {googleEnabled && (
              <a
                href={`/api/auth/google/start?admin=1${rememberMe ? "&remember=1" : ""}`}
                className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-lg border border-brand-border bg-brand-surface text-sm font-medium text-brand-text transition hover:bg-brand-dark"
              >
                Entrar com Google
              </a>
            )}
          </form>
        </div>

        {/* Links de rodapé */}
        <div className="mt-8 flex flex-col items-center gap-4 text-sm animate-fade-in delay-200 opacity-0" style={{ animationFillMode: 'forwards' }}>
          <Link href="/" className="text-brand-muted hover:text-brand-text flex items-center gap-2 transition-colors">
            <span className="w-6 h-[1px] bg-brand-border"></span>
            Retornar ao terminal público
            <span className="w-6 h-[1px] bg-brand-border"></span>
          </Link>
          <p className="text-xs text-brand-muted/60 font-mono tracking-widest uppercase">
            SYS.ADMIN.v2.1
          </p>
        </div>
      </div>
    </main>
  );
}
