"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Input } from "@/components/ui";

export function AddProductForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [billingType, setBillingType] = useState<"one_time" | "recurring">("one_time");
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !unitPrice.trim()) {
      setError("Nome e valor são obrigatórios.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/dashboard/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          unitPrice: unitPrice.trim().replace(",", "."),
          currency: "BRL",
          billingType,
          billingInterval: billingType === "recurring" ? billingInterval : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar produto");
        return;
      }
      setName("");
      setDescription("");
      setUnitPrice("");
      setBillingType("one_time");
      setBillingInterval("monthly");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro de rede");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="product-name" className="mb-1 block text-xs font-medium text-brand-muted">
          Nome
        </label>
        <Input
          id="product-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Plano Básico"
          className="w-40 bg-brand-surface border-brand-border text-brand-text"
        />
      </div>
      <div>
        <label htmlFor="product-price" className="mb-1 block text-xs font-medium text-brand-muted">
          Valor (R$)
        </label>
        <Input
          id="product-price"
          type="text"
          inputMode="decimal"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          placeholder="0,00"
          className="w-28 bg-brand-surface border-brand-border text-brand-text"
        />
      </div>
      <div>
        <label htmlFor="product-billing" className="mb-1 block text-xs font-medium text-brand-muted">
          Cobrança
        </label>
        <select
          id="product-billing"
          value={billingType}
          onChange={(e) => setBillingType(e.target.value as "one_time" | "recurring")}
          className="rounded-md border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-neon"
        >
          <option value="one_time">Pagamento único</option>
          <option value="recurring">Recorrente</option>
        </select>
      </div>
      {billingType === "recurring" && (
        <div>
          <label htmlFor="product-interval" className="mb-1 block text-xs font-medium text-brand-muted">
            Intervalo
          </label>
          <select
            id="product-interval"
            value={billingInterval}
            onChange={(e) => setBillingInterval(e.target.value as "monthly" | "yearly")}
            className="rounded-md border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-neon"
          >
            <option value="monthly">Mensal</option>
            <option value="yearly">Anual</option>
          </select>
        </div>
      )}
      <div>
        <label htmlFor="product-desc" className="mb-1 block text-xs font-medium text-brand-muted">
          Descrição (opcional)
        </label>
        <Input
          id="product-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Breve descrição"
          className="w-48 bg-brand-surface border-brand-border text-brand-text"
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        size="sm"
        className="btn-cta-primary"
        disabled={submitting}
      >
        {submitting ? "Salvando…" : "Adicionar produto"}
      </Button>
      {error && (
        <p className="w-full text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
