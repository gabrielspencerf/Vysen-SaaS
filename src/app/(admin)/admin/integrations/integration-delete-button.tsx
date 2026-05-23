"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui";

type Provider =
  | "evolution"
  | "typebot"
  | "uazapi"
  | "chatwoot"
  | "whatsapp_cloud";

const PROVIDER_META: Record<
  Provider,
  { label: string; pathSegment: string }
> = {
  evolution: { label: "instância Evolution", pathSegment: "evolution" },
  typebot: { label: "bot Typebot", pathSegment: "typebot" },
  uazapi: { label: "instância UAZAPI", pathSegment: "uazapi" },
  chatwoot: { label: "conta Chatwoot", pathSegment: "chatwoot" },
  whatsapp_cloud: {
    label: "número WhatsApp Cloud",
    pathSegment: "whatsapp-cloud",
  },
};

export function IntegrationDeleteButton({
  id,
  provider,
  label = "Excluir",
}: {
  id: string;
  provider: Provider;
  label?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const meta = PROVIDER_META[provider];
  const providerLabel = meta.label;
  const path = `/api/admin/integrations/${meta.pathSegment}/${id}`;

  async function handleDelete() {
    if (
      !confirm(
        `Excluir ${providerLabel}? Conversas e eventos vinculados serão removidos.`
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(path, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "Erro ao excluir");
        return;
      }
      alert(`${providerLabel} excluída com sucesso.`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      onClick={handleDelete}
      disabled={loading}
      aria-label={label}
    >
      <Trash2 className="h-4 w-4" aria-hidden />
    </Button>
  );
}
