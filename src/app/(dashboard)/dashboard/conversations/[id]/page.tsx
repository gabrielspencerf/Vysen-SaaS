import Link from "next/link";
import { notFound } from "next/navigation";
import {
  User,
  Phone,
  CheckCheck,
  Mic,
  Image,
  Bot,
  ArrowLeft,
  Lock,
  Mail,
} from "lucide-react";
import {
  getDashboardTenantContext,
  getConversationDetailForTenant,
  type ConversationDetailMessage,
} from "@/server/dashboard";
import { ConversationScrollContainer } from "@/components/dashboard/conversation-scroll-container";
import { Badge } from "@/components/ui";
import { Card, CardContent } from "@/components/ui";
import { formatCustom } from "@/lib/i18n/date";

function formatTime(d: Date): string {
  return formatCustom(d, { hour: "2-digit", minute: "2-digit" });
}

function formatDateFull(d: Date): string {
  return formatCustom(d, { dateStyle: "full" });
}

function statusLabel(status: string): string {
  if (status === "open") return "Aberta";
  if (status === "closed") return "Encerrada";
  if (status === "archived") return "Arquivada";
  return status;
}

function statusVariant(status: string): "success" | "default" | "warning" {
  if (status === "open") return "success";
  if (status === "archived") return "warning";
  return "default";
}

function displayInitials(name: string | null, externalId: string): string {
  const src = (name?.trim() || externalId || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase().slice(0, 2);
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return src.slice(0, 2).toUpperCase();
}

function groupMessagesByDay(messages: ConversationDetailMessage[]) {
  const groups: { label: string; items: ConversationDetailMessage[] }[] = [];
  let lastKey = "";
  for (const m of messages) {
    const d = new Date(m.sentAt);
    const key = `${d.getFullYear()}-${String(d.getMonth())}-${String(d.getDate())}`;
    if (key !== lastKey) {
      lastKey = key;
      groups.push({ label: formatDateFull(d), items: [] });
    }
    groups[groups.length - 1]?.items.push(m);
  }
  return groups;
}

export default async function DashboardConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenantId } = await getDashboardTenantContext();
  const { id: conversationId } = await params;
  const conv = await getConversationDetailForTenant(tenantId, conversationId);
  if (!conv) notFound();

  const messages = [...conv.messages].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
  );
  const dayGroups = groupMessagesByDay(messages);
  const displayName = conv.leadName?.trim() || conv.externalId;
  const initials = displayInitials(conv.leadName, conv.externalId);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-col gap-3 border-b border-brand-border bg-brand-surface/90 px-3 py-3 backdrop-blur-sm sm:flex-row sm:items-center sm:gap-4 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/dashboard/conversations"
            className="inline-flex shrink-0 items-center justify-center rounded-lg p-2 text-brand-muted transition-colors hover:bg-brand-surface hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-neon"
            aria-label="Voltar para lista de conversas"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-brand-border bg-brand-dark/40 text-sm font-semibold text-brand-text">
            {conv.leadName?.trim() ? (
              <span aria-hidden>{initials}</span>
            ) : (
              <User className="h-5 w-5 text-brand-muted" aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold leading-tight text-brand-text">
              {displayName}
            </h1>
            <p className="truncate font-mono text-[11px] text-brand-muted">
              {conv.externalId}
              {conv.instanceDisplay ? ` · ${conv.instanceDisplay}` : ""}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(conv.status)} className="text-[10px]">
                {statusLabel(conv.status)}
              </Badge>
              {conv.leadId && (
                <Link
                  href={`/dashboard/leads/${conv.leadId}`}
                  className="text-[11px] font-medium text-brand-neon hover:underline"
                >
                  Ver lead
                </Link>
              )}
              {conv.leadPhone?.trim() && (
                <a
                  href={`tel:${conv.leadPhone.replace(/\s/g, "")}`}
                  className="inline-flex items-center gap-1 text-[11px] text-brand-neon hover:underline"
                >
                  <Phone className="h-3 w-3 shrink-0" aria-hidden />
                  {conv.leadPhone}
                </a>
              )}
              {conv.leadEmail?.trim() && (
                <span className="inline-flex max-w-[200px] items-center gap-1 truncate text-[11px] text-brand-muted">
                  <Mail className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="truncate">{conv.leadEmail}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <ConversationScrollContainer className="bg-brand-dark/35 px-3 py-4 md:px-6">
      {conv.aiInsight && (
        <Card className="mb-5 border-brand-neon/25 bg-brand-surface/85 shadow-sm">
          <CardContent className="p-4">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-brand-neon">
              Resumo comercial · IA
            </p>
            <p className="mt-2 text-sm leading-relaxed text-brand-text">
              {conv.aiInsight.summary ?? "Sem resumo gerado."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Badge variant="default" className="text-[10px]">
                {conv.aiInsight.classificationType}
              </Badge>
              {conv.aiInsight.confidenceScore !== null && (
                <Badge variant="default" className="text-[10px]">
                  Confiança {(conv.aiInsight.confidenceScore * 100).toFixed(0)}%
                </Badge>
              )}
              {conv.aiInsight.suggestedLeadStatus && (
                <Badge variant="info" className="text-[10px]">
                  Lead: {conv.aiInsight.suggestedLeadStatus}
                </Badge>
              )}
              {conv.aiInsight.suggestedOpportunityStage && (
                <Badge variant="info" className="text-[10px]">
                  Oportunidade: {conv.aiInsight.suggestedOpportunityStage}
                </Badge>
              )}
            </div>
            {conv.aiInsight.commercialErrors.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 border-t border-brand-border/50 pt-3 pl-5 text-sm text-amber-400/90">
                {conv.aiInsight.commercialErrors.map((error, index) => (
                  <li key={`${error}-${index}`}>{error}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-16">
            <p className="max-w-sm rounded-xl border border-brand-border bg-brand-surface/80 px-4 py-3 text-center text-sm text-brand-muted">
              Nenhuma mensagem nesta conversa ainda. Novas mensagens aparecem aqui quando sincronizadas.
            </p>
          </div>
        ) : (
          dayGroups.map((group) => (
            <section key={group.label} className="mb-6 last:mb-2">
              <div className="mb-4 flex justify-center">
                <span className="rounded-full border border-brand-border bg-brand-surface/90 px-3 py-1 text-[11px] font-medium text-brand-muted shadow-sm">
                  {group.label}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {group.items.map((m) => {
                  const isOut = m.direction === "out";
                  const isBot = isOut && m.sentByBot;
                  const imageSourceUrl =
                    m.contentType === "image"
                      ? `/api/dashboard/conversations/${conv.id}/messages/${m.id}/media`
                      : null;
                  const audioSourceUrl =
                    m.contentType === "audio"
                      ? `/api/dashboard/conversations/${conv.id}/messages/${m.id}/media`
                      : null;
                  return (
                    <div
                      key={m.id}
                      className={`flex w-full ${isOut ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`relative max-w-[90%] rounded-2xl px-3.5 py-2.5 shadow-sm sm:max-w-[72%] ${
                          isOut
                            ? "rounded-tr-md bg-brand-neon/18 text-brand-text ring-1 ring-brand-neon/30"
                            : "rounded-tl-md bg-brand-surface text-brand-text ring-1 ring-brand-border"
                        }`}
                      >
                        {isBot && (
                          <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-brand-neon">
                            <Bot className="h-3.5 w-3.5" aria-hidden />
                            Bot / IA
                          </div>
                        )}
                        {m.contentType === "audio" && (
                          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-brand-muted">
                            <Mic className="h-3.5 w-3.5" aria-hidden />
                            Áudio
                            {m.contentText ? <span>· transcrito</span> : null}
                          </div>
                        )}
                        {m.contentType === "image" && (
                          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-brand-muted">
                            <Image className="h-3.5 w-3.5" aria-hidden />
                            Imagem
                            {m.contentText ? <span>· descrição</span> : null}
                          </div>
                        )}
                        {m.contentType === "image" && imageSourceUrl && (
                          <img
                            src={imageSourceUrl}
                            alt="Mídia enviada na conversa"
                            className="mb-2 max-h-72 w-auto max-w-full rounded-lg border border-brand-border/40 object-contain"
                            loading="lazy"
                          />
                        )}
                        {m.contentType === "audio" && audioSourceUrl && (
                          <audio
                            controls
                            preload="none"
                            className="mb-2 w-full max-w-xs"
                            src={audioSourceUrl}
                          >
                            Áudio não suportado.
                          </audio>
                        )}
                        <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
                          {m.contentText ??
                            (m.contentType !== "text" &&
                            m.contentType !== "audio" &&
                            m.contentType !== "image"
                              ? `[${m.contentType}]`
                              : m.contentType === "audio"
                                ? "Transcrição indisponível ou pendente."
                                : m.contentType === "image"
                                  ? "Descrição indisponível ou pendente."
                                  : "")}
                        </p>
                        <div className="mt-1.5 flex items-center justify-end gap-1">
                          <time
                            className="text-[10px] text-brand-muted"
                            dateTime={new Date(m.sentAt).toISOString()}
                          >
                            {formatTime(m.sentAt)}
                          </time>
                          {isOut && (
                            <CheckCheck
                              className="h-3.5 w-3.5 text-brand-neon"
                              aria-label="Enviada"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </ConversationScrollContainer>

      <footer className="flex shrink-0 items-center gap-2 border-t border-brand-border bg-brand-surface/90 px-4 py-3 text-sm text-brand-muted backdrop-blur-sm">
        <Lock className="h-4 w-4 shrink-0 text-brand-muted" aria-hidden />
        <p>
          Modo leitura — envio de mensagens pelo painel ainda não está disponível nesta versão.
        </p>
      </footer>
    </div>
  );
}
