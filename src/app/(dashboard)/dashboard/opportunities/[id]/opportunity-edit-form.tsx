"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";

interface OpportunityEditFormProps {
  opportunityId: string;
  defaultValues: {
    stage: string;
    title: string;
    contactStartedAt: string;
    jobValue: string;
    contractedModel: string;
  };
}

const STAGES = [
  { value: "open", label: "Aberta" },
  { value: "qualified", label: "Qualificada" },
  { value: "won", label: "Ganha" },
  { value: "lost", label: "Perdida" },
] as const;

export function OpportunityEditForm({
  opportunityId,
  defaultValues,
}: OpportunityEditFormProps) {
  const [stage, setStage] = useState(defaultValues.stage || "open");
  const [title, setTitle] = useState(defaultValues.title);
  const [contactStartedAt, setContactStartedAt] = useState(
    defaultValues.contactStartedAt
  );
  const [jobValue, setJobValue] = useState(defaultValues.jobValue);
  const [contractedModel, setContractedModel] = useState(
    defaultValues.contractedModel
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/opportunities/${opportunityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage,
          title: title.trim() || null,
          contactStartedAt: contactStartedAt || null,
          contractedModel: contractedModel.trim() || null,
          jobValue: jobValue.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar oportunidade");
        return;
      }
      setSuccess("Oportunidade atualizada.");
    } catch {
      setError("Falha de conexão");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-xl space-y-4 rounded-2xl border border-brand-border bg-brand-surface p-6"
    >
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {success}
        </p>
      )}

      <div>
        <label
          htmlFor="opp_title"
          className="mb-1 block text-sm font-medium text-brand-muted"
        >
          Título
        </label>
        <Input
          id="opp_title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex.: Fechamento contrato plano Pro"
          maxLength={255}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="opp_stage"
            className="mb-1 block text-sm font-medium text-brand-muted"
          >
            Estágio
          </label>
          <select
            id="opp_stage"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="w-full rounded-full border border-brand-border bg-brand-surface/50 px-5 py-3 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-neon/40 focus:border-brand-neon"
          >
            {STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="opp_contact_started_at"
            className="mb-1 block text-sm font-medium text-brand-muted"
          >
            Início do contato
          </label>
          <Input
            id="opp_contact_started_at"
            type="date"
            value={contactStartedAt}
            onChange={(e) => setContactStartedAt(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="opp_job_value"
            className="mb-1 block text-sm font-medium text-brand-muted"
          >
            Valor do trabalho (BRL)
          </label>
          <Input
            id="opp_job_value"
            type="text"
            inputMode="decimal"
            value={jobValue}
            onChange={(e) => setJobValue(e.target.value)}
            placeholder="Ex.: 2000,00"
          />
        </div>
        <div>
          <label
            htmlFor="opp_contracted_model"
            className="mb-1 block text-sm font-medium text-brand-muted"
          >
            Modelo contratado
          </label>
          <Input
            id="opp_contracted_model"
            value={contractedModel}
            onChange={(e) => setContractedModel(e.target.value)}
            placeholder="Ex.: Plano Pro trimestral"
            maxLength={128}
          />
        </div>
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? "Salvando…" : "Salvar oportunidade"}
      </Button>
    </form>
  );
}

