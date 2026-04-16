"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Check, ChevronDown, Mic, MicOff, SendHorizonal, Sparkles, User2, X } from "lucide-react";
import { Button } from "@/components/ui";
import { VysenAuraIcon } from "@/components/vysen-aura-icon";

interface DashboardVysenChatDockProps {
  tenantId: string;
  children: React.ReactNode;
}

type ChatRole = "user" | "assistant";
interface ChatMessage {
  role: ChatRole;
  text: string;
}

interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  contextArea: ContextArea;
  contexts: string[];
  summary: string;
  messages: ChatMessage[];
}

interface PendingChatActionDetail {
  type: "explain" | "use-context-current" | "new-with-context";
  text: string;
}

interface ISpeechRecognitionResultItem {
  transcript: string;
}

interface ISpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: ISpeechRecognitionResultItem;
}

interface ISpeechRecognitionEvent {
  results: ArrayLike<ISpeechRecognitionResult>;
}

interface ISpeechRecognitionErrorEvent {
  error: string;
}

interface ISpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => ISpeechRecognition;

type ContextArea =
  | "geral"
  | "conversas"
  | "leads"
  | "oportunidades"
  | "ads"
  | "funil"
  | "operacao";

const CONTEXT_AREAS: Array<{ id: ContextArea; label: string }> = [
  { id: "geral", label: "Geral" },
  { id: "conversas", label: "Conversas" },
  { id: "leads", label: "Leads" },
  { id: "oportunidades", label: "Oportunidades" },
  { id: "ads", label: "Ads" },
  { id: "funil", label: "Funil" },
  { id: "operacao", label: "Operação" },
];

const MAX_THREADS = 30;
const THREADS_STORAGE_KEY_PREFIX = "vysen-chat-threads";
const ACTIVE_THREAD_STORAGE_KEY_PREFIX = "vysen-chat-active-thread";
const STARTED_STORAGE_KEY_PREFIX = "vysen-chat-started";
const PENDING_ACTION_EVENT = "vysen-pending-chat-action";
const QUICK_PROMPTS = [
  "Quais são os principais gargalos da semana no funil?",
  "Explique o comportamento do gráfico atual e possíveis causas.",
  "Quais ações priorizar hoje para melhorar conversão?",
] as const;

const THINKING_STATUSES = [
  "Lendo tabelas do banco...",
  "Analisando sinais da operação...",
  "Batendo dados entre contextos...",
  "Priorizando ações de maior impacto...",
] as const;

const GOAL_PROMPTS = [
  {
    title: "Diagnosticar",
    prompts: [
      "Mapeie os principais gargalos por etapa do funil nesta semana.",
      "Quais sinais mostram queda de desempenho hoje?",
    ],
  },
  {
    title: "Priorizar",
    prompts: [
      "Liste as 3 ações com maior impacto para hoje.",
      "Qual ajuste de campanha deve entrar primeiro?",
    ],
  },
  {
    title: "Executar",
    prompts: [
      "Transforme sua análise em um plano de execução de 5 passos.",
      "Monte um checklist objetivo para o time comercial.",
    ],
  },
] as const;

function createThreadId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function buildThreadTitle(initialText: string, fallbackIndex: number): string {
  const trimmed = initialText.trim();
  if (!trimmed) return `Conversa ${fallbackIndex}`;
  const title = trimmed.replace(/\s+/g, " ").slice(0, 48);
  return title.length < trimmed.length ? `${title}...` : title;
}

function summarizeThread(messages: ChatMessage[]): string {
  const user = messages.filter((m) => m.role === "user").at(-1)?.text ?? "";
  const assistant = messages.filter((m) => m.role === "assistant").at(-1)?.text ?? "";
  if (!user && !assistant) return "Sem resumo ainda.";
  const userLine = user ? `Pergunta: ${user.replace(/\s+/g, " ").slice(0, 120)}` : "";
  const assistantLine = assistant
    ? `Resposta: ${assistant.replace(/\s+/g, " ").slice(0, 150)}`
    : "";
  return [userLine, assistantLine].filter(Boolean).join(" | ");
}

function normalizeThreads(raw: unknown): ChatThread[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === "object")
    .map((item, index) => {
      const obj = item as Record<string, unknown>;
      const id = typeof obj.id === "string" && obj.id ? obj.id : createThreadId();
      const messages = Array.isArray(obj.messages)
        ? obj.messages
            .filter(
              (m): m is ChatMessage =>
                Boolean(
                  m &&
                    typeof m === "object" &&
                    ((m as { role?: unknown }).role === "user" ||
                      (m as { role?: unknown }).role === "assistant") &&
                    typeof (m as { text?: unknown }).text === "string"
                )
            )
            .map((m) => ({ role: m.role, text: m.text.slice(0, 4000) }))
        : [];
      const title =
        typeof obj.title === "string" && obj.title
          ? obj.title
          : buildThreadTitle(messages[0]?.text ?? "", index + 1);
      const createdAt = typeof obj.createdAt === "string" ? obj.createdAt : nowIso();
      const updatedAt = typeof obj.updatedAt === "string" ? obj.updatedAt : createdAt;
      const contexts = Array.isArray(obj.contexts)
        ? obj.contexts
            .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
            .map((c) => c.trim().slice(0, 380))
            .slice(-30)
        : [];
      const contextArea = CONTEXT_AREAS.some((a) => a.id === obj.contextArea)
        ? (obj.contextArea as ContextArea)
        : "geral";
      const summary =
        typeof obj.summary === "string" && obj.summary.trim()
          ? obj.summary.trim().slice(0, 280)
          : summarizeThread(messages);
      return {
        id,
        title,
        createdAt,
        updatedAt,
        contexts,
        contextArea,
        summary,
        messages,
      };
    })
    .slice(0, MAX_THREADS);
}

function extractContextFromTarget(target: EventTarget | null): string {
  if (!(target instanceof HTMLElement)) return "";
  const invalidTarget = target.closest("input, textarea, select, button, [contenteditable='true']");
  if (invalidTarget) return "";

  const selectionText = window.getSelection()?.toString()?.trim() ?? "";
  if (selectionText) {
    return selectionText.replace(/\s+/g, " ").slice(0, 380);
  }

  const sourceWithContext = target.closest("[data-vysen-context]");
  const dataContext = sourceWithContext?.getAttribute("data-vysen-context")?.trim() ?? "";
  if (dataContext) {
    return dataContext.replace(/\s+/g, " ").slice(0, 380);
  }

  const isChartNode = Boolean(target.closest("svg, canvas, [role='img']"));
  if (isChartNode) {
    const card = target.closest("section, article, [class*='panel']");
    const heading = card?.querySelector("h1, h2, h3, h4, h5, h6")?.textContent?.trim() ?? "";
    const description = card?.querySelector("p")?.textContent?.trim() ?? "";
    const chartText = [heading, description].filter(Boolean).join(" - ");
    if (chartText) {
      return `Gráfico: ${chartText}`.replace(/\s+/g, " ").slice(0, 380);
    }
  }

  const source = target.closest("td, th, p, h1, h2, h3, h4, h5, h6, span, li, a, div");
  const text = source?.textContent?.trim() ?? "";
  return text.replace(/\s+/g, " ").slice(0, 380);
}

function toApiHistory(messages: ChatMessage[]) {
  return messages.slice(-12).map((m) => ({
    role: m.role,
    content: m.text,
  }));
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechApi = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechApi.SpeechRecognition ?? speechApi.webkitSpeechRecognition ?? null;
}

function getContextActionSuggestions(contextArea: ContextArea): string[] {
  const byArea: Record<ContextArea, string[]> = {
    geral: [
      "Resumo executivo do dia em 5 bullets.",
      "Qual decisao devo tomar agora para gerar impacto?",
      "Transforme isso em plano de ação de 24h.",
    ],
    conversas: [
      "Quais conversas indicam maior risco de perda?",
      "Quais respostas devo padronizar para acelerar atendimento?",
      "Resuma os temas recorrentes e uma ação por tema.",
    ],
    leads: [
      "Quais leads devo atacar primeiro e por que?",
      "Onde estou perdendo mais velocidade no ciclo?",
      "Sugira um roteiro rapido de follow-up para os top leads.",
    ],
    oportunidades: [
      "Quais oportunidades estão mais próximas de fechar?",
      "Quais oportunidades precisam de intervenção imediata?",
      "Me dê uma estratégia para destravar negociações paradas.",
    ],
    ads: [
      "Quais campanhas reduzir e quais escalar hoje?",
      "Aponte desperdicios de verba e ajuste recomendado.",
      "Resuma performance por conta e proximo teste.",
    ],
    funil: [
      "Qual etapa do funil está derrubando conversão?",
      "Qual experimento devo testar para recuperar taxa?",
      "Monte plano de melhoria por etapa do funil.",
    ],
    operacao: [
      "Quais filas ou processos exigem atencao agora?",
      "Mostre os gargalos operacionais por prioridade.",
      "Transforme isso em checklist operacional do turno.",
    ],
  };
  return byArea[contextArea] ?? byArea.geral;
}

export function DashboardVysenChatDock({ tenantId, children }: DashboardVysenChatDockProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [contextArea, setContextArea] = useState<ContextArea>("geral");
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [isThreadOpen, setIsThreadOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; text: string } | null>(null);
  const [voiceRealtimeEnabled, setVoiceRealtimeEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [experienceStarted, setExperienceStarted] = useState(false);
  const [thinkingStatusIndex, setThinkingStatusIndex] = useState(0);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const contextRef = useRef<HTMLDivElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const keepListeningRef = useRef(false);
  const supportedVoiceInput = useMemo(() => Boolean(getSpeechRecognitionConstructor()), []);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) ?? null,
    [threads, activeThreadId]
  );
  const messages = activeThread?.messages ?? [];
  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant") ?? null;
  const suggestionPrompts = useMemo(
    () => getContextActionSuggestions(contextArea),
    [contextArea]
  );
  const previousMemorySummaries = useMemo(
    () =>
      threads
        .filter((thread) => thread.id !== activeThreadId && thread.summary.trim())
        .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
        .slice(0, 3)
        .map((thread) => thread.summary),
    [threads, activeThreadId]
  );
  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);
  const threadsStorageKey = `${THREADS_STORAGE_KEY_PREFIX}:${tenantId}`;
  const activeThreadStorageKey = `${ACTIVE_THREAD_STORAGE_KEY_PREFIX}:${tenantId}`;
  const startedStorageKey = `${STARTED_STORAGE_KEY_PREFIX}:${tenantId}`;

  function startExperience() {
    setExperienceStarted(true);
    try {
      localStorage.setItem(startedStorageKey, "1");
    } catch {
      // storage best-effort
    }
  }

  function createThread(options?: { initialContext?: string; initialQuestion?: string }): ChatThread {
    const id = createThreadId();
    const now = nowIso();
    const initialQuestion = options?.initialQuestion?.trim() ?? "";
    const initialContext = options?.initialContext?.trim() ?? "";
    const titleBase = initialQuestion || initialContext;
    return {
      id,
      title: buildThreadTitle(titleBase, threads.length + 1),
      createdAt: now,
      updatedAt: now,
      contextArea: "geral",
      contexts: initialContext ? [initialContext.slice(0, 380)] : [],
      summary: "Sem resumo ainda.",
      messages: [],
    };
  }

  function upsertThread(
    threadId: string,
    updater: (thread: ChatThread) => ChatThread
  ): ChatThread | null {
    let updated: ChatThread | null = null;
    setThreads((prev) =>
      prev.map((thread) => {
        if (thread.id !== threadId) return thread;
        updated = updater(thread);
        return updated;
      })
    );
    return updated;
  }

  function addContextToThread(threadId: string, contextText: string) {
    const normalized = contextText.trim().replace(/\s+/g, " ").slice(0, 380);
    if (!normalized) return;
    setThreads((prev) =>
      prev.map((thread) => {
        if (thread.id !== threadId) return thread;
        const contexts = [normalized, ...thread.contexts.filter((c) => c !== normalized)].slice(0, 30);
        return { ...thread, contexts, updatedAt: nowIso() };
      })
    );
  }

  function startNewConversation(initialContext?: string) {
    if (loading) return;
    const thread = createThread({ initialContext });
    setThreads((prev) => [thread, ...prev].slice(0, MAX_THREADS));
    setActiveThreadId(thread.id);
    setContextArea(thread.contextArea);
    setInput("");
    setError(null);
    if (composerRef.current) {
      composerRef.current.style.height = "54px";
      composerRef.current.focus();
    }
  }

  async function sendMessage(options?: { textOverride?: string }): Promise<string | null> {
    const text = (options?.textOverride ?? input).trim();
    if (!text || loading || !activeThreadId) return null;
    if (isListening) {
      stopListening();
    }
    const currentThread = activeThread;
    if (!currentThread) return null;
    const nextHistory = [...currentThread.messages, { role: "user" as const, text }];
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === activeThreadId
          ? {
              ...thread,
              messages: nextHistory,
              updatedAt: nowIso(),
              title:
                thread.messages.length === 0 ? buildThreadTitle(text, 1) : thread.title,
            }
          : thread
      )
    );
    setInput("");
    if (composerRef.current) {
      composerRef.current.style.height = "54px";
    }
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard/vysen/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          tenantId,
          contextArea,
          history: toApiHistory(nextHistory),
          memoryContext: {
            threadSummary: currentThread.summary,
            threadContexts: currentThread.contexts.slice(0, 10),
            previousSummaries: threads
              .filter((t) => t.id !== currentThread.id && t.summary.trim())
              .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
              .slice(0, 5)
              .map((t) => t.summary),
          },
        }),
      });
      const data = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || !data.answer) {
        setError(data.error ?? "Falha ao consultar a Vysen.");
        return null;
      }
      setThreads((prev) =>
        prev.map((thread) => {
          if (thread.id !== activeThreadId) return thread;
          const messagesWithAnswer = [...thread.messages, { role: "assistant" as const, text: data.answer ?? "" }];
          return {
            ...thread,
            messages: messagesWithAnswer,
            summary: summarizeThread(messagesWithAnswer),
            updatedAt: nowIso(),
          };
        })
      );
      if (voiceRealtimeEnabled && isOpen) {
        speakAnswer(data.answer ?? "");
      }
      return data.answer ?? null;
    } catch {
      setError("Falha de conexão ao consultar a Vysen.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  function autoResizeComposer(value: string) {
    const element = composerRef.current;
    if (!element) return;
    element.style.height = "54px";
    if (value.trim().length === 0) {
      return;
    }
    const nextHeight = Math.min(element.scrollHeight, 200);
    element.style.height = `${nextHeight}px`;
  }

  function stopListening() {
    keepListeningRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }

  function speakAnswer(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 1;
    utterance.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((voice) => /pt-BR/i.test(voice.lang));
    if (preferred) utterance.voice = preferred;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      if (voiceRealtimeEnabled && isOpen) {
        setTimeout(() => {
          void startListening();
        }, 220);
      }
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      if (voiceRealtimeEnabled && isOpen) {
        setTimeout(() => {
          void startListening();
        }, 220);
      }
    };
    window.speechSynthesis.speak(utterance);
  }

  async function startListening() {
    if (!supportedVoiceInput || loading || isSpeaking) return;
    const RecognitionCtor = getSpeechRecognitionConstructor();
    if (!RecognitionCtor) return;
    if (recognitionRef.current) return;

    const recognition = new RecognitionCtor();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    keepListeningRef.current = true;

    recognition.onresult = async (event) => {
      const last = event.results[event.results.length - 1];
      if (!last || !last[0]) return;
      const transcript = (last[0].transcript ?? "").trim();
      if (!transcript) return;
      if (!last.isFinal) {
        setInput(transcript);
        autoResizeComposer(transcript);
        return;
      }
      setInput("");
      if (composerRef.current) composerRef.current.style.height = "54px";
      await sendMessage({ textOverride: transcript });
    };
    recognition.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      if (keepListeningRef.current && voiceRealtimeEnabled && isOpen && !loading && !isSpeaking) {
        setTimeout(() => {
          void startListening();
        }, 260);
      }
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (!loading) {
      setThinkingStatusIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setThinkingStatusIndex((prev) => (prev + 1) % THINKING_STATUSES.length);
    }, 1600);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (!activeThread) return;
    if (activeThread.contextArea !== contextArea) {
      setContextArea(activeThread.contextArea);
    }
  }, [activeThread, contextArea]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(threadsStorageKey);
      const parsed = raw ? normalizeThreads(JSON.parse(raw)) : [];
      if (parsed.length > 0) {
        const savedActive = localStorage.getItem(activeThreadStorageKey);
        const active =
          (savedActive && parsed.some((t) => t.id === savedActive) ? savedActive : null) ??
          parsed[0].id;
        setThreads(parsed);
        setActiveThreadId(active);
        setContextArea(parsed.find((t) => t.id === active)?.contextArea ?? "geral");
      } else {
        const thread = createThread();
        setThreads([thread]);
        setActiveThreadId(thread.id);
        setContextArea("geral");
      }
    } catch {
      const thread = createThread();
      setThreads([thread]);
      setActiveThreadId(thread.id);
      setContextArea("geral");
    }
    try {
      const started = localStorage.getItem(startedStorageKey) === "1";
      setExperienceStarted(started);
    } catch {
      setExperienceStarted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  useEffect(() => {
    if (threads.length === 0) return;
    try {
      localStorage.setItem(threadsStorageKey, JSON.stringify(threads.slice(0, MAX_THREADS)));
      if (activeThreadId) localStorage.setItem(activeThreadStorageKey, activeThreadId);
    } catch {
      // storage best-effort
    }
  }, [threads, activeThreadId, threadsStorageKey, activeThreadStorageKey]);

  useEffect(() => {
    if (!isContextOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!contextRef.current) return;
      if (contextRef.current.contains(event.target as Node)) return;
      setIsContextOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isContextOpen]);

  useEffect(() => {
    if (!isThreadOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!threadRef.current) return;
      if (threadRef.current.contains(event.target as Node)) return;
      setIsThreadOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isThreadOpen]);

  useEffect(() => {
    const onGlobalClick = () => setContextMenu(null);
    const onAction = (event: Event) => {
      const detail = (event as CustomEvent<PendingChatActionDetail>).detail;
      if (!detail || typeof detail.text !== "string") return;
      const text = detail.text.trim();
      if (!text) return;
      setIsOpen(true);
      if (!activeThreadId) {
        const thread = createThread({ initialContext: text });
        setThreads((prev) => [thread, ...prev].slice(0, MAX_THREADS));
        setActiveThreadId(thread.id);
      }
      if (detail.type === "new-with-context") {
        if (!experienceStarted) startExperience();
        startNewConversation(text);
        return;
      }
      if (detail.type === "use-context-current" && activeThreadId) {
        if (!experienceStarted) startExperience();
        addContextToThread(activeThreadId, text);
        return;
      }
      if (detail.type === "explain") {
        if (!experienceStarted) startExperience();
        if (activeThreadId) addContextToThread(activeThreadId, text);
        setInput(`Explique estes dados e o que significam no contexto da operação: "${text}"`);
      }
    };
    document.addEventListener("click", onGlobalClick);
    window.addEventListener(PENDING_ACTION_EVENT, onAction as EventListener);
    return () => {
      document.removeEventListener("click", onGlobalClick);
      window.removeEventListener(PENDING_ACTION_EVENT, onAction as EventListener);
    };
  }, [activeThreadId, experienceStarted]);

  useEffect(() => {
    if (!voiceRealtimeEnabled || !isOpen) {
      stopListening();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      return;
    }
    if (!loading && !isSpeaking) {
      void startListening();
    }
    return () => {
      stopListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceRealtimeEnabled, isOpen, loading, isSpeaking, supportedVoiceInput]);

  useEffect(() => {
    return () => {
      stopListening();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  function handleRightClickContext(event: React.MouseEvent<HTMLDivElement>) {
    const text = extractContextFromTarget(event.target);
    if (!text) return;
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, text });
  }

  function askExplainFromContext(text: string) {
    setIsOpen(true);
    if (!experienceStarted) startExperience();
    if (!activeThreadId) startNewConversation(text);
    if (activeThreadId) addContextToThread(activeThreadId, text);
    setInput(`Explique estes dados e o que significam no contexto da operação: "${text}"`);
    setContextMenu(null);
  }

  function applyAsCurrentContext(text: string) {
    setIsOpen(true);
    if (!experienceStarted) startExperience();
    if (!activeThreadId) startNewConversation(text);
    if (activeThreadId) addContextToThread(activeThreadId, text);
    setContextMenu(null);
  }

  function applyAsNewConversation(text: string) {
    setIsOpen(true);
    if (!experienceStarted) startExperience();
    startNewConversation(text);
    setContextMenu(null);
  }

  return (
    <>
      <div
        onContextMenu={handleRightClickContext}
        className={`flex min-h-screen min-w-0 flex-1 transition-[padding] duration-200 ${isOpen ? "md:pr-[430px]" : ""}`}
      >
        <main className="min-h-screen min-w-0 flex-1 overflow-auto bg-brand-dark">
          {children}
        </main>
      </div>

      {isOpen && (
        <aside className="fixed right-0 top-0 z-50 flex h-screen w-[min(98vw,440px)] flex-col overflow-hidden border-l border-brand-border bg-brand-surface/96 shadow-2xl backdrop-blur-sm">
          <div className="pointer-events-none absolute inset-x-[-8%] top-[-70px] z-0 h-[260px] rounded-[50%] bg-brand-neon/8 blur-3xl" />
          {experienceStarted && (
          <header className="relative z-10 border-b border-brand-border/80 bg-brand-surface/94 px-4 py-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
              <div ref={threadRef} className="relative min-w-0">
                <button
                  type="button"
                  onClick={() => setIsThreadOpen((prev) => !prev)}
                  className="inline-flex h-10 w-full items-center justify-between rounded-xl border border-brand-border bg-brand-surface/72 px-3 text-sm text-brand-muted transition hover:text-brand-text"
                  aria-haspopup="listbox"
                  aria-expanded={isThreadOpen}
                >
                  <span className="truncate font-medium">{activeThread?.title ?? "Sem conversa"}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isThreadOpen ? "rotate-180" : ""}`} />
                </button>
                {isThreadOpen && (
                  <div className="absolute left-0 top-full z-20 mt-2 w-full min-w-[280px] overflow-hidden rounded-xl border border-brand-border bg-brand-surface shadow-xl">
                    <div className="max-h-80 overflow-y-auto p-1.5">
                      {threads.map((thread) => (
                        <button
                          key={thread.id}
                          type="button"
                          onClick={() => {
                            setActiveThreadId(thread.id);
                            setContextArea(thread.contextArea);
                            setIsThreadOpen(false);
                            setError(null);
                          }}
                          className={`mb-1 w-full rounded-lg border px-2.5 py-2.5 text-left text-xs ${
                            activeThreadId === thread.id
                              ? "border-brand-neon/35 bg-brand-neon/8 text-brand-text"
                              : "border-brand-border bg-brand-surface/70 text-brand-muted hover:text-brand-text"
                          }`}
                        >
                          <p className="truncate font-semibold">{thread.title}</p>
                          <p className="mt-0.5 truncate">{thread.summary || "Sem resumo ainda."}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => startNewConversation()}
                disabled={loading}
                className="h-10 rounded-xl border border-brand-border bg-brand-surface/72 px-3 text-sm text-brand-muted transition hover:text-brand-text disabled:opacity-60"
              >
                Nova conversa
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-border bg-brand-surface/70 text-brand-text transition hover:bg-brand-surface"
              >
                <span className="sr-only">Fechar chat da Vysen</span>
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>
          )}

          <div ref={messagesContainerRef} className="scroll-hide flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {!experienceStarted ? (
              <div className="relative flex min-h-full items-center justify-center py-6 sm:py-8">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="absolute right-0 top-0 inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-border bg-brand-surface/70 text-brand-text transition hover:bg-brand-surface"
                >
                  <span className="sr-only">Fechar chat da Vysen</span>
                  <X className="h-4 w-4" />
                </button>
                <div className="w-full max-w-md text-center">
                  <div className="mb-4 flex justify-center">
                    <span className="vysen-chat-orb-shell inline-flex h-32 w-32 items-center justify-center rounded-full border border-brand-border bg-brand-surface/80 sm:h-40 sm:w-40">
                      <span className="vysen-chat-orb-ring" />
                      <span className="vysen-chat-orb-ring vysen-chat-orb-ring-secondary" />
                      <VysenAuraIcon className="relative z-[2] h-20 w-20 sm:h-24 sm:w-24" />
                    </span>
                  </div>
                  <p className="text-2xl font-semibold text-brand-text sm:text-3xl">Vysen</p>
                  <p className="mt-2 text-base text-brand-muted sm:text-lg">
                    Sou sua analista de dados da plataforma.
                  </p>
                  <Button
                    type="button"
                    onClick={startExperience}
                    className="mt-6 h-11 rounded-xl px-5 text-sm sm:text-base"
                  >
                    Iniciar
                  </Button>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="rounded-2xl border border-brand-border bg-brand-surface/65 p-4">
                <div className="mb-4 flex flex-col items-center text-center">
                  <span className="vysen-chat-orb-shell mb-2 inline-flex h-24 w-24 items-center justify-center rounded-full border border-brand-border bg-brand-surface/80">
                    <span className="vysen-chat-orb-ring" />
                    <span className="vysen-chat-orb-ring vysen-chat-orb-ring-secondary" />
                    <VysenAuraIcon className="relative z-[2] h-16 w-16" />
                  </span>
                  <p className="text-lg font-semibold text-brand-text">Vysen</p>
                  <p className="mt-1 text-sm text-brand-muted">Sou sua analista de dados da plataforma.</p>
                  <p className="mt-1 text-xs text-brand-muted">Vamos começar?</p>
                </div>
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-brand-surface/80 px-2.5 py-1 text-[10px] uppercase tracking-wide text-brand-muted">
                  <Sparkles className="h-3 w-3 text-brand-neon" />
                  Copiloto Vysen
                </div>
                <p className="text-sm text-brand-muted">
                  Clique com botão direito em gráficos ou dados para pedir explicações, salvar contexto e continuar conversas com memória.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setInput(prompt)}
                      className="rounded-full border border-brand-border bg-brand-surface/80 px-2.5 py-1.5 text-xs text-brand-muted transition hover:border-brand-neon/45 hover:text-brand-text"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  {GOAL_PROMPTS.map((group) => (
                    <div key={group.title} className="rounded-lg border border-brand-border bg-brand-surface/60 p-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">{group.title}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {group.prompts.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => setInput(prompt)}
                            className="rounded-full border border-brand-border bg-brand-surface/80 px-2.5 py-1 text-[11px] text-brand-muted transition hover:border-brand-neon/45 hover:text-brand-text"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, idx) => (
                <div key={`${m.role}-${idx}`} className={`flex items-end gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" ? (
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-brand-border bg-brand-surface/90 text-brand-muted">
                      <Bot className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                  <div
                    className={`max-w-[86%] whitespace-pre-wrap rounded-2xl border px-3 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "border-brand-neon/35 bg-brand-neon/12 text-brand-text"
                        : "border-brand-border bg-brand-surface/72 text-brand-text"
                    }`}
                  >
                    {m.text}
                  </div>
                  {m.role === "user" ? (
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-brand-border bg-brand-surface/90 text-brand-muted">
                      <User2 className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                </div>
              ))
            )}
            {loading && (
              <div className="rounded-lg border border-brand-neon/30 bg-brand-neon/10 px-3 py-2">
                <div className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-brand-text">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-neon" />
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-neon [animation-delay:120ms]" />
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-neon [animation-delay:240ms]" />
                  <span className="ml-1">Pensando</span>
                </div>
                <p className="mt-1 text-xs text-brand-text">{THINKING_STATUSES[thinkingStatusIndex]}</p>
              </div>
            )}
            {!loading && activeThread && activeThread.contexts.length > 0 && (
              <div className="rounded-lg border border-brand-border bg-brand-surface/55 p-2.5">
                <p className="mb-1 text-[10px] uppercase tracking-wide text-brand-muted">
                  Contextos salvos desta conversa
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {activeThread.contexts.slice(0, 5).map((ctx, idx) => (
                    <span
                      key={`${ctx}-${idx}`}
                      className="rounded-full border border-brand-border px-2 py-1 text-[10px] text-brand-muted"
                      title={ctx}
                    >
                      {ctx.slice(0, 48)}
                      {ctx.length > 48 ? "..." : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {!loading && previousMemorySummaries.length > 0 && (
              <div className="rounded-lg border border-brand-border bg-brand-surface/55 p-2.5">
                <p className="mb-1 text-[10px] uppercase tracking-wide text-brand-muted">
                  Memoria operacional recente
                </p>
                <div className="space-y-1.5">
                  {previousMemorySummaries.map((summary, idx) => (
                    <p key={`${summary}-${idx}`} className="line-clamp-2 text-[11px] text-brand-muted">
                      {summary}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {!loading && lastAssistantMessage && (
              <div className="rounded-lg border border-brand-border bg-brand-surface/55 p-2.5">
                <p className="mb-1 text-[10px] uppercase tracking-wide text-brand-muted">
                  Próximas ações sugeridas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestionPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setInput(prompt)}
                      className="rounded-full border border-brand-border bg-brand-surface/78 px-2.5 py-1 text-[11px] text-brand-muted transition hover:border-brand-neon/45 hover:text-brand-text"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="mx-3 mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-300">
              {error}
            </p>
          )}

          {experienceStarted && (
          <footer className="mt-auto border-t border-brand-border/80 bg-brand-surface/98 p-3">
            <div className="rounded-2xl border border-brand-border bg-brand-surface/80 transition focus-within:border-brand-neon/60 focus-within:ring-2 focus-within:ring-brand-neon/20">
              <div className="px-3 pt-2.5">
                <textarea
                  ref={composerRef}
                  rows={2}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    autoResizeComposer(e.target.value);
                  }}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Pergunte para a Vysen..."
                  className="min-h-[68px] w-full flex-1 resize-none bg-transparent text-sm text-brand-text outline-none placeholder:text-brand-muted"
                />
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-brand-border/70 px-2.5 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  {voiceRealtimeEnabled && (
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide ${
                        isListening
                          ? "border-brand-neon/45 bg-brand-neon/10 text-brand-text"
                          : "border-brand-border bg-brand-surface/70 text-brand-muted"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${isListening ? "bg-brand-neon animate-pulse" : "bg-brand-muted"}`} />
                      {isSpeaking ? "falando" : isListening ? "ouvindo" : "pausado"}
                    </span>
                  )}
                  <div ref={contextRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsContextOpen((prev) => !prev)}
                    className="inline-flex h-9 w-[170px] items-center justify-between rounded-lg border border-brand-border bg-brand-surface/70 px-3 text-xs font-medium text-brand-text transition hover:bg-brand-surface/90 focus:outline-none focus:border-brand-neon/60 focus:ring-2 focus:ring-brand-neon/20"
                    aria-haspopup="listbox"
                    aria-expanded={isContextOpen}
                  >
                    <span>{CONTEXT_AREAS.find((a) => a.id === contextArea)?.label ?? "Geral"}</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 text-brand-muted transition-transform ${
                        isContextOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isContextOpen && (
                    <div
                      role="listbox"
                      className="absolute bottom-full mb-2 w-[220px] overflow-hidden rounded-xl border border-brand-border bg-brand-surface shadow-xl"
                    >
                      <div className="max-h-56 overflow-y-auto py-1">
                        {CONTEXT_AREAS.map((area) => {
                          const active = contextArea === area.id;
                          return (
                            <button
                              key={area.id}
                              type="button"
                              onClick={() => {
                                setContextArea(area.id);
                                if (activeThreadId) {
                                  upsertThread(activeThreadId, (thread) => ({
                                    ...thread,
                                    contextArea: area.id,
                                    updatedAt: nowIso(),
                                  }));
                                }
                                setIsContextOpen(false);
                              }}
                              className={`flex w-full items-center justify-between px-3 py-2 text-left text-[12px] transition ${
                                active
                                  ? "bg-brand-neon/15 text-brand-text"
                                  : "text-brand-muted hover:bg-brand-surface/90 hover:text-brand-text"
                              }`}
                            >
                              <span>{area.label}</span>
                              {active && <Check className="h-3.5 w-3.5 text-brand-neon" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={!canSend}
                  size="sm"
                  className="h-9 min-w-9 rounded-full px-2.5"
                >
                  <SendHorizonal className="h-3.5 w-3.5" />
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    if (!supportedVoiceInput) return;
                    setVoiceRealtimeEnabled((prev) => !prev);
                  }}
                  disabled={!supportedVoiceInput}
                  className={`inline-flex h-9 min-w-9 items-center justify-center rounded-full border transition disabled:opacity-45 ${
                    voiceRealtimeEnabled
                      ? "border-brand-neon/45 bg-brand-neon/10 text-brand-text"
                      : "border-brand-border bg-brand-surface/72 text-brand-muted hover:text-brand-text"
                  }`}
                  title={
                    supportedVoiceInput
                      ? voiceRealtimeEnabled
                        ? "Desativar conversa em tempo real"
                        : "Ativar conversa em tempo real"
                      : "Seu navegador não suporta reconhecimento de voz"
                  }
                  aria-label={
                    voiceRealtimeEnabled
                      ? "Desativar conversa em tempo real"
                      : "Ativar conversa em tempo real"
                  }
                >
                  {voiceRealtimeEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </footer>
          )}
        </aside>
      )}

      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-40 inline-flex h-12 items-center gap-2 rounded-full border border-brand-border bg-brand-surface/95 px-3 text-brand-neon shadow-lg backdrop-blur-sm transition hover:-translate-y-[1px] hover:bg-brand-surface"
          aria-label="Abrir chat da Vysen"
        >
          <VysenAuraIcon className="h-5 w-5" />
          <span className="pr-0.5 text-xs font-semibold tracking-wide text-brand-text">Vysen</span>
        </button>
      )}

      {contextMenu && (
        (() => {
          const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
          const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 720;
          const left = Math.min(contextMenu.x, viewportWidth - 286);
          const top = Math.min(contextMenu.y, viewportHeight - 180);
          return (
        <div
          className="fixed z-[70] w-[270px] overflow-hidden rounded-xl border border-brand-border bg-brand-surface/96 shadow-2xl backdrop-blur-sm"
          style={{
            left,
            top,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-brand-border bg-brand-surface/85 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
              Ações da Vysen
            </p>
            <p className="mt-1 line-clamp-2 text-[11px] text-brand-text">{contextMenu.text}</p>
          </div>
          <div className="p-2">
            <button
              type="button"
              onClick={() => askExplainFromContext(contextMenu.text)}
              className="mb-1.5 w-full rounded-lg px-3 py-2 text-left text-xs text-brand-text transition hover:bg-brand-surface"
            >
              Explicar este dado
            </button>
            <button
              type="button"
              onClick={() => applyAsCurrentContext(contextMenu.text)}
              className="mb-1.5 w-full rounded-lg px-3 py-2 text-left text-xs text-brand-text transition hover:bg-brand-surface"
            >
              Usar como contexto da conversa atual
            </button>
            <button
              type="button"
              onClick={() => applyAsNewConversation(contextMenu.text)}
              className="w-full rounded-lg px-3 py-2 text-left text-xs text-brand-text transition hover:bg-brand-surface"
            >
              Iniciar nova conversa com este contexto
            </button>
          </div>
        </div>
          );
        })()
      )}
    </>
  );
}

