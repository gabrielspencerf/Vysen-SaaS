"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { DashboardPageHeader, PageSection } from "@/components/layout";
import { Badge, Button, Card, CardContent } from "@/components/ui";
import { ProviderBrandIcon } from "@/components/provider-brand-icon";

type MessagingProvider = "evolution" | "uazapi";

type InstanceRow = {
  id: string;
  provider: MessagingProvider;
  label: string;
  externalId: string;
  lastStatus: string | null;
  lastSyncedAt: string | null;
};

type LiveStatus = {
  loading: boolean;
  ok?: boolean;
  state?: string;
  /** Mensagem amigável (API não envia detalhes técnicos) */
  userMessage?: string;
};

type QrState = {
  loading: boolean;
  qrDataUrl?: string;
  pairingCode?: string;
  userMessage?: string;
};

function stateLabel(state: string | undefined): string {
  if (!state) return "—";
  const s = state.toLowerCase();
  if (s === "open" || s === "connected") return "Conectado";
  if (s === "close" || s === "closed" || s === "disconnected") return "Desconectado";
  if (s === "connecting") return "Conectando…";
  if (s === "unknown") return "Situação não identificada";
  return state;
}

function InstanceCard({
  row,
  live,
  qr,
  onRefreshStatus,
  onFetchQr,
}: {
  row: InstanceRow;
  live: LiveStatus;
  qr: QrState;
  onRefreshStatus: () => void;
  onFetchQr: () => void;
}) {
  return (
    <Card className="border-brand-border bg-brand-surface">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <ProviderBrandIcon
              provider={row.provider}
              frameClassName="h-9 w-9"
              className="h-7 w-7"
            />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-brand-text truncate">{row.label}</h2>
              <p className="text-xs text-brand-muted font-mono truncate" title={row.externalId}>
                {row.externalId}
              </p>
            </div>
          </div>
          <Badge variant="default" className="shrink-0 capitalize">
            {row.provider === "evolution" ? "Evolution" : "UAZAPI"}
          </Badge>
        </div>

        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            !live.loading && live.userMessage
              ? "border-amber-500/25 bg-amber-500/5"
              : "border-brand-border bg-brand-surface/60"
          }`}
        >
          <span className="text-xs font-medium uppercase tracking-wide text-brand-muted">
            Conexão com o WhatsApp
          </span>
          {live.loading ? (
            <p className="mt-1 text-brand-muted">Consultando o provedor…</p>
          ) : live.userMessage ? (
            <p className="mt-1 text-amber-200 dark:text-amber-100/90">{live.userMessage}</p>
          ) : (
            <p className="mt-1 font-medium text-brand-text">{stateLabel(live.state)}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onRefreshStatus} disabled={live.loading}>
            Atualizar status
          </Button>
          <Button type="button" size="sm" onClick={onFetchQr} disabled={qr.loading}>
            {qr.loading ? "Gerando…" : "Obter QR / reconectar"}
          </Button>
        </div>

        {qr.userMessage ? (
          <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-sm text-amber-200 dark:text-amber-100/90">
            {qr.userMessage}
          </p>
        ) : null}
        {qr.pairingCode ? (
          <p className="text-sm text-brand-muted">
            Código de pareamento:{" "}
            <span className="font-mono text-brand-text">{qr.pairingCode}</span>
          </p>
        ) : null}
        {qr.qrDataUrl ? (
          <div className="flex justify-center rounded-lg border border-brand-border bg-white p-4">
            <Image
              src={qr.qrDataUrl}
              alt="QR Code WhatsApp"
              width={224}
              height={224}
              unoptimized
              className="h-56 w-56 max-w-full object-contain"
            />
          </div>
        ) : null}

        <p className="text-xs text-brand-muted">
          O cadastro da instância continua em Admin → Integrações. Aqui você só consulta status e gera QR para
          reconectar o aparelho.
        </p>
      </CardContent>
    </Card>
  );
}

export default function DashboardSettingsWhatsappPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [instances, setInstances] = useState<InstanceRow[]>([]);
  const [liveById, setLiveById] = useState<Record<string, LiveStatus>>({});
  const [qrById, setQrById] = useState<Record<string, QrState>>({});

  const loadList = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/dashboard/integrations/messaging");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(
          typeof data.error === "string"
            ? data.error
            : "Não foi possível carregar suas integrações de WhatsApp. Atualize a página ou tente mais tarde."
        );
        setInstances([]);
        return;
      }
      const list = Array.isArray(data.instances) ? data.instances : [];
      setInstances(list as InstanceRow[]);
    } catch {
      setLoadError("Sem conexão. Verifique a internet e abra a página novamente.");
      setInstances([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const refreshStatus = useCallback(async (id: string) => {
    setLiveById((prev) => ({ ...prev, [id]: { loading: true } }));
    try {
      const res = await fetch(`/api/dashboard/integrations/messaging/${id}/status`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLiveById((prev) => ({
          ...prev,
          [id]: {
            loading: false,
            ok: false,
            userMessage:
              typeof data.userMessage === "string"
                ? data.userMessage
                : "Não foi possível verificar o status. Tente novamente.",
          },
        }));
        return;
      }
      setLiveById((prev) => ({
        ...prev,
        [id]: {
          loading: false,
          ok: data.ok === true,
          state: typeof data.state === "string" ? data.state : undefined,
          userMessage: typeof data.userMessage === "string" ? data.userMessage : undefined,
        },
      }));
    } catch {
      setLiveById((prev) => ({
        ...prev,
        [id]: {
          loading: false,
          ok: false,
          userMessage: "Sem conexão com o servidor. Confira sua internet e tente de novo.",
        },
      }));
    }
  }, []);

  const fetchQr = useCallback(async (id: string) => {
    setQrById((prev) => ({ ...prev, [id]: { loading: true, userMessage: undefined } }));
    try {
      const res = await fetch(`/api/dashboard/integrations/messaging/${id}/connect`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setQrById((prev) => ({
          ...prev,
          [id]: {
            loading: false,
            userMessage:
              typeof data.userMessage === "string"
                ? data.userMessage
                : "Não foi possível obter o QR. Tente novamente.",
          },
        }));
        return;
      }
      setQrById((prev) => ({
        ...prev,
        [id]: {
          loading: false,
          userMessage: undefined,
          qrDataUrl: typeof data.qrDataUrl === "string" ? data.qrDataUrl : undefined,
          pairingCode: typeof data.pairingCode === "string" ? data.pairingCode : undefined,
        },
      }));
      void refreshStatus(id);
    } catch {
      setQrById((prev) => ({
        ...prev,
        [id]: {
          loading: false,
          userMessage: "Sem conexão com o servidor. Confira sua internet e tente de novo.",
        },
      }));
    }
  }, [refreshStatus]);

  useEffect(() => {
    if (instances.length === 0) return;
    for (const row of instances) {
      void refreshStatus(row.id);
    }
  }, [instances, refreshStatus]);

  useEffect(() => {
    if (instances.length === 0) return;
    const t = setInterval(() => {
      for (const row of instances) {
        void refreshStatus(row.id);
      }
    }, 15000);
    return () => clearInterval(t);
  }, [instances, refreshStatus]);

  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <div className="mb-4">
        <Link
          href="/dashboard/settings"
          className="text-sm text-brand-neon hover:opacity-90"
        >
          ← Voltar às configurações
        </Link>
      </div>

      <DashboardPageHeader
        title="WhatsApp"
        description="Consulte o status da instância na Evolution ou UAZAPI e gere QR para reconectar o número ao WhatsApp."
        iconNode={
          <ProviderBrandIcon
            provider="whatsapp"
            variant="plain"
            className="brand-icon-monochrome h-4 w-4"
          />
        }
        badges={loading ? [] : [`${instances.length} instância(ões)`]}
      />

      {loadError ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {loadError}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-brand-muted">Carregando instâncias…</p>
      ) : instances.length === 0 ? (
        <Card className="border-brand-border bg-brand-surface">
          <CardContent className="p-6">
            <p className="text-sm text-brand-muted">
              Nenhuma instância de mensagens vinculada a este tenant. Peça ao administrador para cadastrar
              Evolution ou UAZAPI em Admin → Integrações.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {instances.map((row) => (
            <InstanceCard
              key={row.id}
              row={row}
              live={liveById[row.id] ?? { loading: true }}
              qr={qrById[row.id] ?? { loading: false }}
              onRefreshStatus={() => void refreshStatus(row.id)}
              onFetchQr={() => void fetchQr(row.id)}
            />
          ))}
        </div>
      )}
    </PageSection>
  );
}
