"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, SendHorizonal, User2 } from "lucide-react";
import { Button } from "@/components/ui";

interface VysenCopilotChatProps {
  tenantId?: string | null;
  endpoint?: string;
  title?: string;
  description?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export function VysenCopilotChat({
  tenantId,
  endpoint = "/api/admin/vysen/chat",
  title = "Modo analítico",
  description = "Pergunte sobre gargalos, funil, campanhas e recomendações estratégicas.",
}: VysenCopilotChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const quickPrompts = useMemo(
    () => [
      "Quais são os maiores gargalos do meu funil hoje?",
      "Onde posso reduzir custo e manter performance em Ads?",
      "Quais oportunidades têm maior chance de fechamento?",
    ],
    []
  );

  function resizeTextarea(value: string) {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "52px";
    if (!value.trim()) return;
    const nextHeight = Math.min(el.scrollHeight, 170);
    el.style.height = `${nextHeight}px`;
  }

  async function ask(overrideQuestion?: string) {
    const nextQuestion = (overrideQuestion ?? question).trim();
    if (!nextQuestion || loading) return;
    setLoading(true);
    setError(null);
    setQuestion("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "52px";
    }
    setMessages((prev) => [...prev, { role: "user", text: nextQuestion }]);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: nextQuestion, tenantId }),
      });
      const data = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || !data.answer) {
        setError(data.error ?? "Falha ao consultar a Vysen.");
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", text: data.answer ?? "" }]);
    } catch {
      setError("Falha de conexão ao consultar a Vysen.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, loading]);

  function onComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void ask();
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div ref={messagesRef} className="scroll-hide flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-brand-border bg-brand-surface/55 p-3">
            <h3 className="text-sm font-semibold text-brand-text">{title}</h3>
            <p className="mt-1 text-xs text-brand-muted">{description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void ask(prompt)}
                  disabled={loading}
                  className="rounded-full border border-brand-border bg-brand-surface/70 px-2.5 py-1 text-[11px] text-brand-muted transition hover:border-brand-neon/45 hover:text-brand-text disabled:opacity-60"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, idx) => {
            const user = message.role === "user";
            return (
              <div
                key={`${message.role}-${idx}`}
                className={`flex items-end gap-2 ${user ? "justify-end" : "justify-start"}`}
              >
                {!user && (
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-brand-border bg-brand-surface/90 text-brand-muted">
                    <Bot className="h-3.5 w-3.5" />
                  </span>
                )}
                <div
                  className={`max-w-[88%] whitespace-pre-wrap rounded-2xl border px-3 py-2 text-xs leading-relaxed ${
                    user
                      ? "border-brand-neon/35 bg-brand-neon/12 text-brand-text"
                      : "border-brand-border bg-brand-surface/65 text-brand-text"
                  }`}
                >
                  {message.text}
                </div>
                {user && (
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-brand-border bg-brand-surface/90 text-brand-muted">
                    <User2 className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
            );
          })
        )}

        {loading && (
          <div className="flex items-center gap-2 rounded-xl border border-brand-border bg-brand-surface/65 px-3 py-2 text-[11px] text-brand-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Vysen analisando dados da operação...</span>
          </div>
        )}
      </div>

      {error && (
        <p className="mx-3 mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-300">
          {error}
        </p>
      )}

      <footer className="mt-auto border-t border-brand-border/80 bg-brand-surface/96 p-3">
        <div className="rounded-2xl border border-brand-border bg-brand-surface/80 transition focus-within:border-brand-neon/55 focus-within:ring-2 focus-within:ring-brand-neon/20">
          <div className="px-3 pt-2.5">
            <textarea
              ref={textareaRef}
              rows={2}
              value={question}
              onChange={(event) => {
                setQuestion(event.target.value);
                resizeTextarea(event.target.value);
              }}
              onKeyDown={onComposerKeyDown}
              placeholder="Ex.: Onde está o maior gargalo entre aquisição e fechamento?"
              className="min-h-[52px] w-full resize-none bg-transparent text-xs text-brand-text outline-none placeholder:text-brand-muted"
            />
          </div>

          <div className="flex items-center justify-between border-t border-brand-border/70 px-2.5 py-2">
            <span className="text-[10px] text-brand-muted">Enter envia · Shift+Enter quebra linha</span>
            <Button
              type="button"
              onClick={() => void ask()}
              disabled={loading || !question.trim()}
              size="sm"
              className="h-8 min-w-8 rounded-full px-2.5"
            >
              <SendHorizonal className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </footer>
    </section>
  );
}

