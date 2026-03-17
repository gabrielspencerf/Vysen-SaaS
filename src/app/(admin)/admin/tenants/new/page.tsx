"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageSection } from "@/components/layout/page-section";
import { Input, Button } from "@/components/ui";

export default function NewTenantPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function deriveSlug(value: string) {
    setSlug(
      value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar tenant");
        return;
      }
      router.push("/admin/tenants");
      router.refresh();
    } catch {
      setError("Erro de conexão");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <div className="mb-6">
        <Link
          href="/admin/tenants"
          className="text-sm text-brand-muted hover:text-brand-text transition-colors"
        >
          ← Voltar
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-brand-text mb-6">Novo tenant</h1>
      <form onSubmit={handleSubmit} className="max-w-md space-y-6">
        {error && (
          <div
            role="alert"
            className="rounded bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500"
          >
            {error}
          </div>
        )}
        <div className="space-y-2">
          <label htmlFor="name" className="block text-sm font-medium text-brand-text">
            Nome
          </label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              deriveSlug(e.target.value);
            }}
            className="w-full bg-brand-surface border-brand-border text-brand-text"
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="slug" className="block text-sm font-medium text-brand-text">
            Slug
          </label>
          <Input
            id="slug"
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full bg-brand-surface border-brand-border text-brand-text font-mono"
            required
          />
        </div>
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={submitting}
            >
            {submitting ? "Criando…" : "Criar"}
          </Button>
          <Link href="/admin/tenants">
            <Button type="button" variant="secondary">Cancelar</Button>
          </Link>
        </div>
      </form>
    </PageSection>
  );
}
