"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { PageSection } from "@/components/layout";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "new", label: "Novo" },
  { value: "contacted", label: "Contactado" },
  { value: "qualified", label: "Qualificado" },
  { value: "converted", label: "Convertido" },
  { value: "lost", label: "Perdido" },
  { value: "duplicate", label: "Duplicado" },
  { value: "bad_lead", label: "Lead ruim" },
];

interface LeadEditFormProps {
  leadId: string;
  defaultValues: {
    name: string;
    email: string;
    phone: string;
    status: string;
  };
}

export function LeadEditForm({ leadId, defaultValues }: LeadEditFormProps) {
  const router = useRouter();
  const [name, setName] = useState(defaultValues.name);
  const [email, setEmail] = useState(defaultValues.email);
  const [phone, setPhone] = useState(defaultValues.phone);
  const [status, setStatus] = useState(defaultValues.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar");
        return;
      }
      router.push(`/dashboard/leads/${leadId}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PageSection variant="plain" className="px-0 py-0">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="lead-name"
              className="mb-1.5 block text-sm font-medium text-brand-text"
            >
              Nome
            </label>
            <Input
              id="lead-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do lead"
              className="w-full"
            />
          </div>
          <div>
            <label
              htmlFor="lead-email"
              className="mb-1.5 block text-sm font-medium text-brand-text"
            >
              E-mail
            </label>
            <Input
              id="lead-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className="w-full"
            />
          </div>
          <div>
            <label
              htmlFor="lead-phone"
              className="mb-1.5 block text-sm font-medium text-brand-text"
            >
              Telefone
            </label>
            <Input
              id="lead-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+55 11 99999-9999"
              className="w-full"
            />
          </div>
          <div>
            <label
              htmlFor="lead-status"
              className="mb-1.5 block text-sm font-medium text-brand-text"
            >
              Status
            </label>
            <select
              id="lead-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="block w-full rounded-full border border-brand-border bg-brand-surface/50 px-5 py-3 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-neon/40 focus:border-brand-neon disabled:opacity-50 transition-colors backdrop-blur-sm"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-500" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar alterações"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push(`/dashboard/leads/${leadId}`)}
            disabled={saving}
          >
            Cancelar
          </Button>
        </div>
      </PageSection>
    </form>
  );
}
