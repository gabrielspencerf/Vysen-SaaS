"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sendVysenChatMessage } from "@/features/vysen-chat/api/chat-client";
import {
  fetchVysenThreadsServer,
  upsertVysenThreadServer,
} from "@/features/vysen-chat/api/threads-client";
import {
  MAX_THREADS,
  buildThreadTitle,
  createEmptyThread,
  createThreadId,
  createChatMessage,
  normalizeChatMessages,
  normalizeChatThreads,
  nowIso,
  summarizeThread,
  toChatApiHistory,
} from "@/features/vysen-chat/model/mappers";
import type {
  VysenChatMessage,
  VysenChatThread,
  VysenContextArea,
} from "@/features/vysen-chat/model/types";

interface UseVysenChatOptions {
  endpoint: string;
  tenantId?: string | null;
  storageKey?: string;
}

interface PersistedVysenChatState {
  version: 2;
  threads: VysenChatThread[];
  activeThreadId: string | null;
  experienceStarted: boolean;
}

interface UseVysenChatResult {
  threads: VysenChatThread[];
  activeThread: VysenChatThread | null;
  activeThreadId: string | null;
  experienceStarted: boolean;
  previousSummaries: string[];
  contextArea: VysenContextArea;
  messages: VysenChatMessage[];
  loading: boolean;
  error: string | null;
  startExperience: () => void;
  setActiveThread: (threadId: string) => void;
  setContextArea: (area: VysenContextArea) => void;
  addContextToActiveThread: (contextText: string) => void;
  startNewConversation: (initialContext?: string) => void;
  sendMessage: (question: string) => Promise<boolean>;
}

function isPersistedState(input: unknown): input is PersistedVysenChatState {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Partial<PersistedVysenChatState>;
  return candidate.version === 2 && Array.isArray(candidate.threads);
}

export function useVysenChat({
  endpoint,
  tenantId,
  storageKey,
}: UseVysenChatOptions): UseVysenChatResult {
  const [threads, setThreads] = useState<VysenChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [experienceStarted, setExperienceStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const resolvedStorageKey = useMemo(() => {
    if (!storageKey) return null;
    return tenantId ? `${storageKey}:${tenantId}` : storageKey;
  }, [storageKey, tenantId]);

  const legacyThreadsStorageKey = useMemo(
    () => (tenantId ? `vysen-chat-threads:${tenantId}` : null),
    [tenantId]
  );
  const legacyActiveStorageKey = useMemo(
    () => (tenantId ? `vysen-chat-active-thread:${tenantId}` : null),
    [tenantId]
  );
  const legacyStartedStorageKey = useMemo(
    () => (tenantId ? `vysen-chat-started:${tenantId}` : null),
    [tenantId]
  );
  const legacyMessagesStorageKey = useMemo(
    () => (tenantId ? `vysen-copilot-chat:${tenantId}` : "vysen-copilot-chat"),
    [tenantId]
  );

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [threads, activeThreadId]
  );
  const messages = useMemo(() => activeThread?.messages ?? [], [activeThread]);
  const contextArea = useMemo(
    () => activeThread?.contextArea ?? "geral",
    [activeThread]
  );
  const previousSummaries = useMemo(
    () =>
      threads
        .filter(
          (thread) =>
            thread.id !== activeThreadId &&
            thread.summary.trim() &&
            thread.summary.trim() !== "Sem resumo ainda."
        )
        .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
        .slice(0, 3)
        .map((thread) => thread.summary),
    [threads, activeThreadId]
  );

  useEffect(() => {
    if (!resolvedStorageKey) return;
    try {
      const raw = localStorage.getItem(resolvedStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (isPersistedState(parsed)) {
          const parsedThreads = normalizeChatThreads(parsed.threads);
          if (parsedThreads.length > 0) {
            const active = parsed.activeThreadId && parsedThreads.some((thread) => thread.id === parsed.activeThreadId)
              ? parsed.activeThreadId
              : parsedThreads[0].id;
            setThreads(parsedThreads);
            setActiveThreadId(active);
            setExperienceStarted(Boolean(parsed.experienceStarted));
            return;
          }
        }
        const legacyMessages = normalizeChatMessages(parsed);
        if (legacyMessages.length > 0) {
          const now = nowIso();
          const thread: VysenChatThread = {
            id: createThreadId(),
            title: buildThreadTitle(legacyMessages[0]?.text ?? "", 1),
            createdAt: now,
            updatedAt: now,
            contextArea: "geral",
            contexts: [],
            summary: summarizeThread(legacyMessages),
            messages: legacyMessages,
          };
          setThreads([thread]);
          setActiveThreadId(thread.id);
          setExperienceStarted(true);
          return;
        }
      }

      const legacyThreadsRaw = legacyThreadsStorageKey
        ? localStorage.getItem(legacyThreadsStorageKey)
        : null;
      if (legacyThreadsRaw) {
        const parsedLegacy = normalizeChatThreads(JSON.parse(legacyThreadsRaw));
        if (parsedLegacy.length > 0) {
          const legacyActive = legacyActiveStorageKey
            ? localStorage.getItem(legacyActiveStorageKey)
            : null;
          const active =
            legacyActive && parsedLegacy.some((thread) => thread.id === legacyActive)
              ? legacyActive
              : parsedLegacy[0].id;
          const started = legacyStartedStorageKey
            ? localStorage.getItem(legacyStartedStorageKey) === "1"
            : true;
          setThreads(parsedLegacy);
          setActiveThreadId(active);
          setExperienceStarted(started);
          return;
        }
      }

      const fallbackMessagesRaw = localStorage.getItem(legacyMessagesStorageKey);
      if (fallbackMessagesRaw) {
        const fallbackMessages = normalizeChatMessages(JSON.parse(fallbackMessagesRaw));
        if (fallbackMessages.length > 0) {
          const now = nowIso();
          const thread: VysenChatThread = {
            id: createThreadId(),
            title: buildThreadTitle(fallbackMessages[0]?.text ?? "", 1),
            createdAt: now,
            updatedAt: now,
            contextArea: "geral",
            contexts: [],
            summary: summarizeThread(fallbackMessages),
            messages: fallbackMessages,
          };
          setThreads([thread]);
          setActiveThreadId(thread.id);
          setExperienceStarted(true);
          return;
        }
      }

      const emptyThread = createEmptyThread(1);
      setThreads([emptyThread]);
      setActiveThreadId(emptyThread.id);
      setExperienceStarted(false);
    } catch {
      const emptyThread = createEmptyThread(1);
      setThreads([emptyThread]);
      setActiveThreadId(emptyThread.id);
      setExperienceStarted(false);
    }
  }, [
    resolvedStorageKey,
    legacyThreadsStorageKey,
    legacyActiveStorageKey,
    legacyStartedStorageKey,
    legacyMessagesStorageKey,
  ]);

  useEffect(() => {
    if (!resolvedStorageKey || threads.length === 0) return;
    try {
      const payload: PersistedVysenChatState = {
        version: 2,
        threads: threads.slice(0, MAX_THREADS),
        activeThreadId,
        experienceStarted,
      };
      localStorage.setItem(resolvedStorageKey, JSON.stringify(payload));
    } catch {
      // persistencia best-effort
    }
  }, [threads, activeThreadId, experienceStarted, resolvedStorageKey]);

  // Server sync — só ativa quando há tenantId (sessão autenticada).
  const serverHydratedRef = useRef(false);
  const syncedThreadsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!tenantId || serverHydratedRef.current) return;
    let cancelled = false;
    (async () => {
      const serverThreads = await fetchVysenThreadsServer();
      if (cancelled) return;
      if (serverThreads.length > 0) {
        const hydrated = serverThreads
          .map(
            (row): VysenChatThread => ({
              id: row.id,
              title: row.title,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
              contextArea: row.contextArea as VysenContextArea,
              contexts: row.contexts ?? [],
              summary: row.summary || "Sem resumo ainda.",
              messages: row.messages ?? [],
            })
          )
          .slice(0, MAX_THREADS);
        setThreads(hydrated);
        setActiveThreadId(hydrated[0].id);
        setExperienceStarted(
          serverThreads.some((t) => t.experienceStarted || t.messageCount > 0)
        );
        // Marca como sincronizadas pra evitar PUT redundante na próxima passada.
        for (const t of serverThreads) {
          syncedThreadsRef.current.set(t.id, t.updatedAt);
        }
      }
      serverHydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  // Após hidratar (ou imediatamente se não há tenant), sincroniza
  // mudanças locais via debounce — best-effort, falha não bloqueia UI.
  useEffect(() => {
    if (!tenantId || !serverHydratedRef.current || threads.length === 0) return;
    const synced = syncedThreadsRef.current;
    const dirty = threads.filter((t) => synced.get(t.id) !== t.updatedAt);
    if (dirty.length === 0) return;
    const handle = window.setTimeout(() => {
      for (const t of dirty) {
        upsertVysenThreadServer(t, experienceStarted).then((row) => {
          if (row) synced.set(row.id, row.updatedAt);
        });
      }
    }, 600);
    return () => window.clearTimeout(handle);
  }, [threads, experienceStarted, tenantId]);

  const startExperience = useCallback(() => {
    setExperienceStarted(true);
  }, []);

  const setActiveThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId);
    setError(null);
  }, []);

  const setContextArea = useCallback((area: VysenContextArea) => {
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === activeThreadId
          ? { ...thread, contextArea: area, updatedAt: nowIso() }
          : thread
      )
    );
  }, [activeThreadId]);

  const addContextToActiveThread = useCallback(
    (contextText: string) => {
      const normalized = contextText.trim().replace(/\s+/g, " ").slice(0, 380);
      if (!normalized || !activeThreadId) return;
      setThreads((prev) =>
        prev.map((thread) => {
          if (thread.id !== activeThreadId) return thread;
          const contexts = [normalized, ...thread.contexts.filter((value) => value !== normalized)].slice(0, 30);
          return { ...thread, contexts, updatedAt: nowIso() };
        })
      );
    },
    [activeThreadId]
  );

  const startNewConversation = useCallback(
    (initialContext?: string) => {
      const normalized = initialContext?.trim().replace(/\s+/g, " ").slice(0, 380) ?? "";
      const now = nowIso();
      const newThread: VysenChatThread = {
        id: createThreadId(),
        title: buildThreadTitle(normalized, threads.length + 1),
        createdAt: now,
        updatedAt: now,
        contextArea: "geral",
        contexts: normalized ? [normalized] : [],
        summary: "Sem resumo ainda.",
        messages: [],
      };
      setThreads((prev) => [newThread, ...prev].slice(0, MAX_THREADS));
      setActiveThreadId(newThread.id);
      setError(null);
    },
    [threads.length]
  );

  const sendMessage = useCallback(
    async (question: string) => {
      const nextQuestion = question.trim();
      if (!nextQuestion || inFlightRef.current || !activeThreadId) return false;

      const currentThread = threads.find((thread) => thread.id === activeThreadId);
      if (!currentThread) return false;

      inFlightRef.current = true;
      setLoading(true);
      setError(null);
      const nextMessages = [...currentThread.messages, createChatMessage("user", nextQuestion)];
      setThreads((prev) =>
        prev.map((thread) =>
          thread.id === activeThreadId
            ? {
                ...thread,
                messages: nextMessages,
                updatedAt: nowIso(),
                title:
                  thread.messages.length === 0
                    ? buildThreadTitle(nextQuestion, 1)
                    : thread.title,
              }
            : thread
        )
      );

      try {
        const result = await sendVysenChatMessage({
          endpoint,
          question: nextQuestion,
          contextArea: currentThread.contextArea,
          history: toChatApiHistory(nextMessages),
          memoryContext: {
            threadSummary: currentThread.summary,
            threadContexts: currentThread.contexts.slice(0, 10),
            previousSummaries: threads
              .filter(
                (thread) =>
                  thread.id !== currentThread.id &&
                  thread.summary.trim() &&
                  thread.summary.trim() !== "Sem resumo ainda."
              )
              .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
              .slice(0, 5)
              .map((thread) => thread.summary),
          },
        });

        if (!result.answer) {
          setError(result.error ?? "Falha ao consultar a Vysen.");
          return false;
        }

        setThreads((prev) =>
          prev.map((thread) => {
            if (thread.id !== activeThreadId) return thread;
            const updatedMessages = [
              ...thread.messages,
              createChatMessage("assistant", result.answer ?? ""),
            ];
            return {
              ...thread,
              messages: updatedMessages,
              summary: summarizeThread(updatedMessages),
              updatedAt: nowIso(),
            };
          })
        );
        return true;
      } catch {
        setError("Falha de conexão ao consultar a Vysen.");
        return false;
      } finally {
        setLoading(false);
        inFlightRef.current = false;
      }
    },
    [endpoint, activeThreadId, threads]
  );

  return {
    threads,
    activeThread,
    activeThreadId,
    experienceStarted,
    previousSummaries,
    contextArea,
    messages,
    loading,
    error,
    startExperience,
    setActiveThread,
    setContextArea,
    addContextToActiveThread,
    startNewConversation,
    sendMessage,
  };
}
