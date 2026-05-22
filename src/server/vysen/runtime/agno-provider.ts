import type { VysenRuntimeProvider } from "@/server/vysen/runtime/provider";
import type {
  VysenRuntimeSessionInput,
  VysenSessionContext,
  VysenWorkflowRunRequest,
  VysenWorkflowRunResult,
} from "@/server/vysen/runtime/types";

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Provider que delega para o serviço Agno (Python) via HTTP.
 *
 * Requisitos de segurança:
 * - Token compartilhado via `VYSEN_AGNO_TOKEN` (header `X-Vysen-Token`). Sem o
 *   token configurado, lança erro no startup do provider — evita expor o serviço
 *   sem autenticação caso o operador esqueça de configurá-lo.
 * - Timeout obrigatório em toda chamada (`AbortSignal.timeout`); sem isso, uma
 *   indisponibilidade do Agno trava o worker indefinidamente.
 *
 * Fallback é responsabilidade do caller (orchestrator) — este provider apenas
 * lança erro se a comunicação falhar; quem consome decide se faz downgrade.
 */
export class AgnoVysenRuntimeProvider implements VysenRuntimeProvider {
  readonly mode = "agno" as const;
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;

  constructor(serviceUrl: string, options?: { token?: string; timeoutMs?: number }) {
    this.baseUrl = serviceUrl.replace(/\/$/, "");
    const token = options?.token ?? process.env.VYSEN_AGNO_TOKEN ?? "";
    if (!token) {
      // Fail-fast: melhor quebrar no boot do que rodar com Agno exposto sem auth.
      throw new Error(
        "VYSEN_AGNO_TOKEN ausente. Defina antes de habilitar VYSEN_AGNO_ENABLED."
      );
    }
    this.token = token;
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private async post<T>(path: string, payload: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Vysen-Token": this.token,
        "User-Agent": "vysen-app/agno-client",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`agno_http_${response.status}`);
    }
    return (await response.json()) as T;
  }

  async getSessionContext(input: VysenRuntimeSessionInput): Promise<VysenSessionContext> {
    return this.post<VysenSessionContext>("/sessions/context", input);
  }

  async queueWorkflowRun(input: VysenWorkflowRunRequest): Promise<VysenWorkflowRunResult> {
    return this.post<VysenWorkflowRunResult>("/workflows/run", input);
  }
}
