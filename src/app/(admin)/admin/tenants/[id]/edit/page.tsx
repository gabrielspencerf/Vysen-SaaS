"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { PageSection } from "@/components/layout/page-section";
import { Input, Button } from "@/components/ui";

interface TenantData {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

export default function EditTenantPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/admin/tenants/${id}`, { method: "GET" });
      if (res.status === 404) {
        setTenant(null);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      setTenant(data);
      setName(data.name ?? "");
      setSlug(data.slug ?? "");
      setIsActive(data.isActive ?? true);
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          is_active: isActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erro ao atualizar");
        return;
      }
      router.push(`/admin/tenants/${id}`);
      router.refresh();
    } catch {
      setError("Erro de conexão");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <PageSection>
        <p className="text-brand-muted">Carregando…</p>
      </PageSection>
    );
  }
  if (!tenant) {
    return (
      <PageSection>
        <p className="text-brand-muted">Tenant não encontrado.</p>
        <Link href="/admin/tenants" className="mt-2 inline-block text-sm text-brand-neon hover:text-brand-neon/80">
          Voltar
        </Link>
      </PageSection>
    );
  }

  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <div className="mb-6">
        <Link
          href={`/admin/tenants/${id}`}
          className="text-sm text-brand-muted hover:text-brand-text transition-colors"
        >
          ← Voltar
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-brand-text mb-6">Editar tenant</h1>
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
            onChange={(e) => setName(e.target.value)}
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
        <div className="flex items-center gap-2">
          <input
            id="is_active"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-brand-border bg-brand-surface text-brand-neon focus:ring-brand-neon"
          />
          <label htmlFor="is_active" className="text-sm text-brand-text">
            Ativo
          </label>
        </div>
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={submitting}
            className="btn-cta-primary"
          >
            {submitting ? "Salvando…" : "Salvar"}
          </Button>
          <Button asChild variant="secondary" className="border-brand-border text-brand-text hover:bg-brand-surface">
            <Link href={`/admin/tenants/${id}`}>Cancelar</Link>
          </Button>
        </div>
      </form>
    </PageSection>
  );
}
