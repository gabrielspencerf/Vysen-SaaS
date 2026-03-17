"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Input } from "@/components/ui";

export function PageSpeedForm({ initialUrl }: { initialUrl: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const handleSaveUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/dashboard/pagespeed/landing-url", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Erro ao salvar" });
        return;
      }
      setMessage({ type: "ok", text: "URL salva." });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Erro de rede" });
    } finally {
      setSaving(false);
    }
  };

  const handleFetch = async () => {
    setFetching(true);
    setMessage(null);
    try {
      const res = await fetch("/api/dashboard/pagespeed/fetch", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Erro ao analisar" });
        return;
      }
      setMessage({ type: "ok", text: "Análise concluída. Atualize a página para ver os resultados." });
      window.location.reload();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Erro de rede" });
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="rounded-lg border border-brand-border bg-brand-surface/50 p-4">
      <form onSubmit={handleSaveUrl} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[280px] flex-1">
          <label htmlFor="landing-url" className="mb-1 block text-xs font-medium text-brand-muted">
            URL da landing
          </label>
          <Input
            id="landing-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://seusite.com.br"
            className="w-full bg-brand-surface border-brand-border text-brand-text"
          />
        </div>
        <Button type="submit" variant="secondary" size="sm" disabled={saving}>
          {saving ? "Salvando…" : "Salvar URL"}
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="btn-cta-primary"
          onClick={handleFetch}
          disabled={fetching || !url.trim()}
        >
          {fetching ? "Analisando…" : "Atualizar análise"}
        </Button>
      </form>
      {message && (
        <p
          className={`mt-3 text-sm ${message.type === "ok" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
          role="alert"
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
