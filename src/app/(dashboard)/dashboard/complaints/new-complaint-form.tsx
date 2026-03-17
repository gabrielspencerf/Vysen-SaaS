"use client";

import { useState } from "react";
import { Button, Card, CardContent, Input } from "@/components/ui";

export function NewComplaintForm() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!body.trim()) {
      setError("Descreva sua reclamação ou feedback.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/dashboard/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim() || undefined,
          body: body.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao enviar");
        return;
      }
      setSubject("");
      setBody("");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro de rede");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-brand-border bg-brand-surface">
      <CardContent className="p-6">
        <h2 className="text-base font-semibold text-brand-text">
          Enviar reclamação / feedback
        </h2>
        <p className="mt-1 text-sm text-brand-muted">
          Descreva o problema com contexto. Se possível, informe data/hora e o que você esperava que acontecesse.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-1">
            <label
              htmlFor="complaint-subject"
              className="mb-1 block text-sm font-medium text-brand-muted"
            >
              Assunto (opcional)
            </label>
            <Input
              id="complaint-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex.: Atendimento demorado"
              maxLength={255}
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="complaint-body"
              className="mb-1 block text-sm font-medium text-brand-muted"
            >
              Sua reclamação ou feedback <span className="text-red-500">*</span>
            </label>
            <textarea
              id="complaint-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Descreva o que não está bom..."
              rows={4}
              className="w-full rounded-2xl border border-brand-border bg-brand-surface/50 px-5 py-3 text-sm text-brand-text placeholder:text-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-neon/40 focus:border-brand-neon disabled:opacity-50 transition-colors backdrop-blur-sm"
            />
          </div>

          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Enviando…" : "Enviar"}
            </Button>
            {error && (
              <p
                className="text-sm text-red-600 dark:text-red-400"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
