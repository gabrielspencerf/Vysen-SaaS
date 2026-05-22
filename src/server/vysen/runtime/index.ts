import { AgnoVysenRuntimeProvider } from "@/server/vysen/runtime/agno-provider";
import { getVysenRuntimeConfig } from "@/server/vysen/runtime/config";
import { LocalVysenRuntimeProvider } from "@/server/vysen/runtime/local-provider";
import type { VysenRuntimeProvider } from "@/server/vysen/runtime/provider";

let cachedProvider: VysenRuntimeProvider | null = null;

/**
 * Resolve o provider Vysen ativo.
 *
 * Em modo `agno`, se a construção do provider falhar (token ausente, URL
 * inválida), faz downgrade automático para o provider local com warning — assim
 * uma configuração incompleta degrada graciosamente em vez de derrubar o boot.
 * Para falhar fechado (sem downgrade), use `VYSEN_AGNO_REQUIRED=true`.
 */
export function getVysenRuntimeProvider(): VysenRuntimeProvider {
  if (cachedProvider) return cachedProvider;

  const config = getVysenRuntimeConfig();
  if (config.mode === "agno" && config.serviceUrl) {
    try {
      cachedProvider = new AgnoVysenRuntimeProvider(config.serviceUrl);
      return cachedProvider;
    } catch (err) {
      if (process.env.VYSEN_AGNO_REQUIRED === "true") {
        throw err;
      }
      console.warn(
        "[vysen] Agno provider falhou; usando provider local como fallback.",
        err instanceof Error ? err.message : String(err)
      );
    }
  }
  cachedProvider = new LocalVysenRuntimeProvider();
  return cachedProvider;
}

export { getVysenRuntimeConfig } from "@/server/vysen/runtime/config";
export type * from "@/server/vysen/runtime/types";
