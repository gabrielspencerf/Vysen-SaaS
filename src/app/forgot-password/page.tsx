"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Falha ao solicitar redefinição.");
        return;
      }
      setMessage("Se o e-mail existir e estiver ativo, enviaremos um link de redefinição.");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
      <div className="w-full rounded-2xl border border-brand-border bg-brand-surface p-6">
        <h1 className="text-xl font-semibold text-brand-text">Esqueci minha senha</h1>
        <p className="mt-2 text-sm text-brand-muted">
          Informe seu e-mail para receber o link de redefinição.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <Input
            id="forgot-email"
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
          />
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Enviando..." : "Enviar link"}
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
