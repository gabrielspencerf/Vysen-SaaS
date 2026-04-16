"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui";
import { AppModal } from "@/components/ui/app-modal";
import { Download, Upload, FileSpreadsheet, X, FileUp, Loader2 } from "lucide-react";

const linkButtonClass =
  "fx-button inline-flex items-center justify-center gap-2 rounded-md border border-brand-border bg-transparent px-4 py-2 text-xs font-medium uppercase tracking-wider text-brand-text transition-all hover:bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-muted disabled:opacity-50";

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

const MODAL_EXIT_MS = 180;
const MODAL_PANEL_BASE_CLASS =
  "relative w-full rounded-2xl border border-brand-border bg-brand-surface p-5 shadow-2xl";

export function ImportExportActions({
  exportUrl,
  importUrl,
  templateUrl,
  search,
  label,
}: ImportExportActionsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalClosing, setIsImportModalClosing] = useState(false);
  const [isExportModalClosing, setIsExportModalClosing] = useState(false);
  const [draggingFile, setDraggingFile] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx">("csv");

  const exportHref =
    search?.trim() ? `${exportUrl}?search=${encodeURIComponent(search.trim())}` : exportUrl;

  const runImport = async (file?: File) => {
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
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    await runImport(file);
    e.target.value = "";
  };

  const handleDropFile = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    await runImport(file);
  };

  const effectiveExportHref = exportFormat === "csv" ? exportHref : undefined;

  const openImportModal = () => {
    setIsImportModalClosing(false);
    setIsImportModalOpen(true);
  };

  const closeImportModal = () => {
    setIsImportModalClosing(true);
    window.setTimeout(() => {
      setIsImportModalOpen(false);
      setIsImportModalClosing(false);
    }, MODAL_EXIT_MS);
  };

  const openExportModal = () => {
    setIsExportModalClosing(false);
    setIsExportModalOpen(true);
  };

  const closeExportModal = () => {
    setIsExportModalClosing(true);
    window.setTimeout(() => {
      setIsExportModalOpen(false);
      setIsExportModalClosing(false);
    }, MODAL_EXIT_MS);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={linkButtonClass} onClick={openExportModal}>
        <Download className="h-4 w-4" />
        Exportar
      </button>
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
        onClick={openImportModal}
        disabled={importing}
      >
        <Upload className="h-4 w-4" />
        {importing ? "Importando…" : "Importar"}
      </Button>

      <a
        href={templateUrl}
        download={`modelo-${label.toLowerCase()}.csv`}
        className={linkButtonClass}
      >
        <FileSpreadsheet className="h-4 w-4" />
        Modelo
      </a>

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

      <AppModal
        isOpen={isImportModalOpen}
        isClosing={isImportModalClosing}
        onClose={closeImportModal}
        labelledBy="import-modal-title"
        describedBy="import-modal-description"
        panelClassName={`${MODAL_PANEL_BASE_CLASS} max-w-xl ${
          isImportModalClosing
            ? "animate-out fade-out zoom-out-95 slide-out-to-bottom-2 duration-200"
            : "animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200"
        }`}
      >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 id="import-modal-title" className="text-base font-semibold text-brand-text">
                  Importar {label}
                </h3>
                <p id="import-modal-description" className="text-sm text-brand-muted">
                  Envie um CSV arrastando o arquivo ou selecionando no computador.
                </p>
              </div>
              <button
                type="button"
                onClick={closeImportModal}
                className="rounded-md p-1 text-brand-muted hover:bg-brand-dark hover:text-brand-text"
                aria-label="Fechar modal de importação"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              ref={dropRef}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDraggingFile(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDraggingFile(false);
              }}
              onDrop={handleDropFile}
              className={`rounded-xl border-2 border-dashed p-8 text-center transition ${
                draggingFile
                  ? "border-brand-neon bg-brand-neon/10"
                  : "border-brand-border bg-brand-dark/20"
              }`}
            >
              <FileUp className="mx-auto mb-3 h-7 w-7 text-brand-neon" />
              <p className="text-sm text-brand-text">Arraste e solte o arquivo CSV aqui</p>
              <p className="mt-1 text-xs text-brand-muted">ou use o botao abaixo</p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button type="button" onClick={() => inputRef.current?.click()} disabled={importing}>
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  "Selecionar arquivo CSV"
                )}
              </Button>
              <a
                href={templateUrl}
                download={`modelo-${label.toLowerCase()}.csv`}
                className={linkButtonClass}
              >
                Baixar modelo
              </a>
              <Button type="button" variant="secondary" onClick={closeImportModal}>
                Fechar
              </Button>
            </div>
            {importing ? (
              <div className="mt-3 rounded-lg border border-brand-border bg-brand-dark/20 p-3">
                <div className="popup-loading-shimmer h-2 w-full rounded-full" />
                <p className="mt-2 text-xs text-brand-muted">
                  Processando arquivo e validando linhas...
                </p>
              </div>
            ) : null}
      </AppModal>

      <AppModal
        isOpen={isExportModalOpen}
        isClosing={isExportModalClosing}
        onClose={closeExportModal}
        labelledBy="export-modal-title"
        describedBy="export-modal-description"
        panelClassName={`${MODAL_PANEL_BASE_CLASS} max-w-lg ${
          isExportModalClosing
            ? "animate-out fade-out zoom-out-95 slide-out-to-bottom-2 duration-200"
            : "animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200"
        }`}
      >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 id="export-modal-title" className="text-base font-semibold text-brand-text">
                  Exportar {label}
                </h3>
                <p id="export-modal-description" className="text-sm text-brand-muted">
                  Escolha o formato final do arquivo para download.
                </p>
              </div>
              <button
                type="button"
                onClick={closeExportModal}
                className="rounded-md p-1 text-brand-muted hover:bg-brand-dark hover:text-brand-text"
                aria-label="Fechar modal de exportação"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-brand-border p-3">
                <input
                  type="radio"
                  name="export-format"
                  checked={exportFormat === "csv"}
                  onChange={() => setExportFormat("csv")}
                />
                <span className="text-sm text-brand-text">CSV (disponivel)</span>
              </label>
              <label className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-brand-border/50 p-3 opacity-65">
                <input
                  type="radio"
                  name="export-format"
                  checked={exportFormat === "xlsx"}
                  onChange={() => setExportFormat("xlsx")}
                  disabled
                />
                <span className="text-sm text-brand-muted">XLSX (em breve)</span>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {effectiveExportHref ? (
                <a href={effectiveExportHref} download className={linkButtonClass}>
                  Baixar arquivo
                </a>
              ) : (
                <Button type="button" disabled>
                  Formato indisponivel
                </Button>
              )}
              <a
                href={templateUrl}
                download={`modelo-${label.toLowerCase()}.csv`}
                className={linkButtonClass}
              >
                Baixar modelo
              </a>
              <Button type="button" variant="secondary" onClick={closeExportModal}>
                Fechar
              </Button>
            </div>
      </AppModal>
    </div>
  );
}
