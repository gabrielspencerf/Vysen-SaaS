"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const mode = useMemo(() => searchParams.get("mode") ?? "reset", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!token) {
      setError("Token inválido.");
      return;
    }
    if (password.length < 8) {
      setError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("A confirmação de senha não confere.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível redefinir a senha.");
        return;
      }
      setMessage("Senha atualizada com sucesso. Redirecionando para login...");
      setTimeout(() => router.push("/login"), 1200);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
      <div className="w-full rounded-2xl border border-brand-border bg-brand-surface p-6">
        <h1 className="text-xl font-semibold text-brand-text">
          {mode === "setup" ? "Definir senha de acesso" : "Redefinir senha"}
        </h1>
        <p className="mt-2 text-sm text-brand-muted">
          Informe sua nova senha para concluir o acesso.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <Input
            id="reset-password"
            name="password"
            type="password"
            autoComplete={mode === "setup" ? "new-password" : "current-password"}
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nova senha"
            minLength={8}
            required
          />
          <Input
            id="reset-confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirmar nova senha"
            minLength={8}
            required
          />
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Salvando..." : "Salvar senha"}
          </Button>
        </form>
        {message && <p className="mt-3 text-sm text-emerald-400">{message}</p>}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <p className="mt-4 text-sm text-brand-muted">
          <Link href="/login" className="text-brand-neon hover:underline">
            Voltar para login
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
          <div className="w-full rounded-2xl border border-brand-border bg-brand-surface p-6">
            <div className="h-6 w-44 animate-pulse rounded bg-brand-surface" />
            <div className="mt-4 h-24 animate-pulse rounded bg-brand-surface" />
          </div>
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
