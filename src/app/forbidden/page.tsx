import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acesso negado",
  description: "Você não possui permissão para acessar este recurso.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  alternates: {
    canonical: "/forbidden",
  },
};

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold text-brand-text">Acesso negado</h1>
      <p className="text-center text-brand-muted">
        Você não tem permissão para acessar este recurso.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/"
          className="text-sm text-brand-neon underline hover:opacity-90"
        >
          Voltar ao início
        </Link>
        <Link
          href="/dashboard"
          className="text-sm text-brand-neon underline hover:opacity-90"
        >
          Ir para o Dashboard
        </Link>
      </div>
    </main>
  );
}
