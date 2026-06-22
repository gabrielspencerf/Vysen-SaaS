"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui";
import { Upload, Trash2 } from "lucide-react";

type Asset = {
  id: string;
  kind: string;
  displayName: string | null;
  contentType: string | null;
  fileSizeBytes: number | null;
  createdAt: string;
};

const KIND_LABEL: Record<string, string> = {
  logo: "Logo",
  photo: "Foto",
  document: "Documento",
};

export function CompanyFilesSection() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState<"logo" | "photo" | "document">("logo");

  const load = () => {
    fetch("/api/dashboard/tenant-assets")
      .then((res) => res.json())
      .then((data) => setAssets(Array.isArray(data) ? data : []))
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("kind", kind);
    formData.set("displayName", file.name);
    fetch("/api/dashboard/tenant-assets", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) load();
      })
      .finally(() => {
        setUploading(false);
        e.target.value = "";
      });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Remover este arquivo?")) return;
    fetch(`/api/dashboard/tenant-assets/${id}`, { method: "DELETE" })
      .then((res) => res.ok && load());
  };

  return (
    <Card className="mt-6 border-brand-border bg-brand-surface">
      <CardContent className="p-6">
        <h2 className="text-base font-semibold text-brand-text">Arquivos da empresa</h2>
        <p className="mt-1 text-sm text-brand-muted">
          Logo, fotos e documentos. Máximo 5 MB por arquivo (imagens ou PDF).
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "logo" | "photo" | "document")}
            className="rounded-md border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text"
          >
            <option value="logo">Logo</option>
            <option value="photo">Foto</option>
            <option value="document">Documento</option>
          </select>
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
            <span className="inline-flex items-center gap-2 rounded-md border border-brand-border bg-brand-surface px-3 py-2 text-sm font-medium text-brand-text hover:bg-brand-surface/80">
              <Upload className="h-4 w-4" />
              {uploading ? "Enviando…" : "Enviar arquivo"}
            </span>
          </label>
        </div>
        {loading ? (
          <p className="mt-4 text-sm text-brand-muted">Carregando...</p>
        ) : assets.length === 0 ? (
          <p className="mt-4 text-sm text-brand-muted">Nenhum arquivo enviado.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {assets.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-md border border-brand-border bg-brand-surface/50 px-3 py-2"
              >
                <div className="min-w-0">
                  <span className="text-sm font-medium text-brand-text">
                    {a.displayName ?? a.id.slice(0, 8)}
                  </span>
                  <span className="ml-2 text-xs text-brand-muted">
                    {KIND_LABEL[a.kind] ?? a.kind}
                    {a.fileSizeBytes != null && ` · ${(a.fileSizeBytes / 1024).toFixed(1)} KB`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/dashboard/tenant-assets/${a.id}/file`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand-neon hover:underline"
                  >
                    Ver
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(a.id)}
                    className="text-brand-muted hover:text-red-500"
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
