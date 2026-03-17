"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui";
import { Download, Upload, FileSpreadsheet } from "lucide-react";

const linkButtonClass =
  "inline-flex items-center justify-center gap-2 font-medium rounded-md px-4 py-2 text-xs font-medium uppercase tracking-wider border border-brand-border bg-transparent text-brand-text hover:bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-muted disabled:opacity-50 transition-all";

export interface ImportExportActionsProps {
  /** Ex.: /api/dashboard/leads/export */
  exportUrl: string;
  /** Ex.: /api/dashboard/leads/import */
  importUrl: string;
  /** Ex.: /templates/modelo-leads.csv */
  templateUrl: string;
  /** Valor atual da busca (opcional); anexado à URL de export */
  search?: string;
  /** "Leads" ou "Contatos" para mensagens */
  label: "Leads" | "Contatos";
}

interface ImportResult {
  created: number;
  skipped: number;
  errors: { line: number; message: string }[];
}

export function ImportExportActions({
  exportUrl,
  importUrl,
  templateUrl,
  search,
  label,
}: ImportExportActionsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const exportHref =
    search?.trim() ? `${exportUrl}?search=${encodeURIComponent(search.trim())}` : exportUrl;

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setResult(null);
    const formData = new FormData();
    formData.set("file", file);
    try {
      const res = await fetch(importUrl, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setResult({
          created: 0,
          skipped: 0,
          errors: [{ line: 0, message: data.error ?? "Erro na importação" }],
        });
        return;
      }
      setResult(data as ImportResult);
      if (data.created > 0 || data.skipped > 0) {
        window.location.reload();
      }
    } catch (err) {
      setResult({
        created: 0,
        skipped: 0,
        errors: [{ line: 0, message: err instanceof Error ? err.message : "Erro de rede" }],
      });
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={exportHref} download className={linkButtonClass}>
        <Download className="h-4 w-4" />
        Exportar
      </a>
      <a
        href={templateUrl}
        download={`modelo-${label.toLowerCase()}.csv`}
        className={linkButtonClass}
      >
        <FileSpreadsheet className="h-4 w-4" />
        Modelo
      </a>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        aria-label={`Importar ${label} (CSV)`}
        onChange={handleImport}
        disabled={importing}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="gap-1.5"
        onClick={() => inputRef.current?.click()}
        disabled={importing}
      >
        <Upload className="h-4 w-4" />
        {importing ? "Importando…" : "Importar"}
      </Button>
      {result && (
        <div
          className="w-full text-sm text-brand-muted mt-2 p-2 rounded bg-brand-text/5 border border-brand-border"
          role="status"
        >
          {result.created > 0 && <span>{result.created} {label.toLowerCase()} criados. </span>}
          {result.skipped > 0 && <span>{result.skipped} ignorados (duplicados). </span>}
          {result.errors.length > 0 && (
            <span>
              Erros: {result.errors.slice(0, 5).map((e) => `Linha ${e.line}: ${e.message}`).join("; ")}
              {result.errors.length > 5 && ` (+${result.errors.length - 5} mais)`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
