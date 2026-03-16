import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Phone, CheckCheck } from "lucide-react";
import {
  getDashboardTenantContext,
  getConversationDetailForTenant,
} from "@/server/dashboard";

function formatTime(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

function formatDateFull(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
  }).format(new Date(d));
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

  // Sort messages by date ascending
  const messages = [...conv.messages].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
  );

  return (
    <div className="panel-lux flex h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-2xl border border-brand-border">
      {/* Header */}
      <header className="flex items-center gap-4 bg-[#f0f2f5] dark:bg-[#202c33] px-4 py-3 border-b border-brand-border">
        <Link
          href="/dashboard/conversations"
          className="text-brand-muted hover:text-brand-text transition-colors p-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-300 dark:bg-neutral-600">
          <User className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-brand-text leading-tight">
            {conv.externalId}
          </h1>
          <p className="text-xs text-brand-muted">
            {conv.leadName ? `Lead: ${conv.leadName}` : "Lead anônimo"} • {conv.status}
          </p>
        </div>
        <div className="flex gap-4 text-brand-muted">
          <Phone className="h-5 w-5" />
        </div>
      </header>

      {/* Chat Area */}
      <div 
        className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-2"
        style={{
          backgroundImage: "url('https://static.whatsapp.net/rsrc.php/v3/yl/r/rI2F7RMB7rB.png')",
          backgroundRepeat: "repeat",
          backgroundSize: "400px",
          opacity: 0.9
        }}
      >
        <div className="flex justify-center mb-4">
          <span className="bg-white dark:bg-[#182229] border border-brand-border dark:border-none shadow-sm rounded-lg px-3 py-1 text-xs text-brand-muted">
            {formatDateFull(conv.startedAt)}
          </span>
        </div>

        {messages.length === 0 ? (
          <div className="flex justify-center items-center h-full">
            <div className="bg-white/80 dark:bg-[#182229]/80 backdrop-blur rounded-xl px-4 py-3 text-sm text-brand-muted text-center max-w-sm">
              Nenhuma mensagem encontrada nesta conversa ainda.
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isOut = m.direction === "out";
            return (
              <div
                key={m.id}
                className={`flex w-full ${isOut ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`relative max-w-[85%] sm:max-w-[70%] rounded-lg px-3 py-2 shadow-sm ${
                    isOut
                      ? "bg-[#d9fdd3] dark:bg-[#005c4b] rounded-tr-none text-[#111b21] dark:text-[#e9edef]"
                      : "bg-white dark:bg-[#202c33] rounded-tl-none text-[#111b21] dark:text-[#e9edef]"
                  }`}
                >
                  <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
                    {m.contentText ?? (m.contentType !== "text" ? `[${m.contentType}]` : "")}
                  </p>
                  <div className="flex items-center justify-end gap-1 mt-1 -mb-1">
                    <span className="text-[11px] text-black/50 dark:text-white/50">
                      {formatTime(m.sentAt)}
                    </span>
                    {isOut && (
                      <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer / Input area mock */}
      <footer className="bg-[#f0f2f5] dark:bg-[#202c33] px-4 py-3 flex items-center gap-3">
        <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-lg px-4 py-2.5 text-sm text-brand-muted">
          Conversa em modo leitura (não usável)...
        </div>
      </footer>
    </div>
  );
}
