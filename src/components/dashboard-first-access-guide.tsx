"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Circle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui";

interface DashboardFirstAccessGuideProps {
  tenantId: string;
  userEmail: string;
}

interface ProfileCheckPayload {
  name: string | null;
}

const GUIDE_STORAGE_KEY_PREFIX = "vysen:first-access:guide";
const GUIDE_OPEN_EVENT = "vysen-open-first-access-guide";
const GUIDE_DISMISS_HOURS = 12;

type GuideActionStatus = "pending" | "in_progress" | "completed";

interface GuideAction {
  id: "profile" | "channel" | "funnel";
  title: string;
  description: string;
  href: string;
  status: GuideActionStatus;
}

export function DashboardFirstAccessGuide({
  tenantId,
  userEmail,
}: DashboardFirstAccessGuideProps) {
  const storageKey = useMemo(
    () => `${GUIDE_STORAGE_KEY_PREFIX}:${tenantId}:${userEmail}`,
    [tenantId, userEmail]
  );
  const [open, setOpen] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [loadingActions, setLoadingActions] = useState(false);
  const [actions, setActions] = useState<GuideAction[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? (JSON.parse(raw) as { status?: string; dismissedAt?: number }) : null;
      if (parsed?.status === "released") return;
      if (
        parsed?.status === "dismissed" &&
        typeof parsed.dismissedAt === "number" &&
        Date.now() - parsed.dismissedAt < GUIDE_DISMISS_HOURS * 60 * 60 * 1000
      ) {
        return;
      }
      setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!open) return;
    setCheckingProfile(true);
    fetch("/api/context/profile")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) return;
        const payload = data as ProfileCheckPayload;
        setProfileReady(Boolean(payload.name?.trim()));
      })
      .finally(() => setCheckingProfile(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoadingActions(true);
    fetch("/api/dashboard/onboarding/status")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) return;
        const nextActions = Array.isArray(data?.actions)
          ? (data.actions as GuideAction[])
          : [];
        setActions(nextActions.slice(0, 3));
      })
      .finally(() => setLoadingActions(false));
  }, [open]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(GUIDE_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(GUIDE_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismissGuide();
      }
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [open, dismissGuide]);

  function releaseAccess() {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ status: "released", releasedAt: Date.now() })
      );
    } catch {
      // melhor esforço
    }
    setOpen(false);
  }

  function dismissGuide() {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ status: "dismissed", dismissedAt: Date.now() })
      );
    } catch {
      // melhor esforço
    }
    setOpen(false);
  }

  function statusLabel(status: GuideActionStatus) {
    if (status === "completed") return "Concluído";
    if (status === "in_progress") return "Em progresso";
    return "Pendente";
  }

  function statusClassName(status: GuideActionStatus) {
    if (status === "completed") {
      return "border-emerald-500/65 bg-emerald-500/20 text-emerald-800 dark:text-emerald-200";
    }
    if (status === "in_progress") {
      return "border-brand-neon/55 bg-brand-neon/15 text-brand-text";
    }
    return "border-brand-border bg-brand-surface/70 text-brand-muted";
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-access-guide-title"
      className="fixed inset-0 z-[65] flex items-center justify-center bg-brand-dark/78 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-2xl">
        <div className="relative overflow-hidden border-b border-brand-border/70 bg-brand-surface/95 p-6">
          <div className="absolute -left-8 -top-8 h-36 w-36 rounded-full bg-brand-neon/15 blur-2xl" />
          <div className="absolute -right-6 top-4 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-neon/30 bg-brand-neon/10 px-3 py-1 text-xs font-medium text-brand-text">
              <Sparkles className="h-3.5 w-3.5 text-brand-neon" />
              Primeiros passos no Vysen
            </div>
            <h2 id="first-access-guide-title" className="max-w-2xl text-2xl font-semibold leading-tight text-brand-text">
              Inteligência operacional para transformar dados em decisão e crescimento
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-muted">
              O Vysen cruza sinais de conversas, leads, funil e mídia para mostrar prioridades
              com clareza. Menos adivinhação, mais ação objetiva todos os dias.
            </p>
            <div className="mt-4 grid gap-2 text-xs text-brand-muted sm:grid-cols-3">
              <div className="rounded-lg border border-brand-border bg-brand-surface/60 px-3 py-2">
                Diagnóstico rápido dos gargalos reais
              </div>
              <div className="rounded-lg border border-brand-border bg-brand-surface/60 px-3 py-2">
                Contexto unificado para operação e vendas
              </div>
              <div className="rounded-lg border border-brand-border bg-brand-surface/60 px-3 py-2">
                Sugestões de próxima ação com foco em resultado
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-3">
            <p className="text-sm font-medium text-brand-text">Jornada de primeiro valor</p>
            {loadingActions ? (
              <p className="rounded-lg border border-brand-border bg-brand-surface/65 px-3 py-2 text-xs text-brand-muted">
                Carregando passos iniciais...
              </p>
            ) : (
              actions.map((action) => (
                <div key={action.id} className="rounded-xl border border-brand-border bg-brand-surface/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-brand-text">{action.title}</p>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wide ${statusClassName(action.status)}`}>
                      {statusLabel(action.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-brand-muted">{action.description}</p>
                  <Link
                    href={action.href}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-surface/85 px-3 py-1.5 text-xs font-medium text-brand-text transition hover:bg-brand-surface"
                  >
                    Abrir etapa
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ))
            )}
          </div>

          <div className="rounded-xl border border-brand-border bg-brand-surface/65 p-4">
            <p className="text-sm font-semibold text-brand-text">Liberação de acesso</p>
            <p className="mt-1 text-xs leading-relaxed text-brand-muted">
              Você pode continuar depois, mas recomendamos concluir o perfil para personalizar sua
              experiência desde o início.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 text-xs text-brand-muted">
              {profileReady ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
              {checkingProfile
                ? "Validando perfil..."
                : profileReady
                  ? "Perfil pronto para liberar."
                  : "Complete seu nome no perfil para liberar."}
            </div>
            <Link
              href="/dashboard/settings"
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand-border bg-brand-surface/85 px-3 py-2 text-xs font-medium text-brand-text transition hover:bg-brand-surface"
            >
              Configurar perfil agora
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-brand-border/70 bg-brand-surface/90 px-6 py-4">
          <Button
            type="button"
            variant="secondary"
            onClick={dismissGuide}
            className="border-brand-border"
          >
            Continuar depois
          </Button>
          <Button
            type="button"
            onClick={releaseAccess}
            disabled={!profileReady}
          >
            Liberar acesso
          </Button>
        </div>
      </div>
    </div>
  );
}
