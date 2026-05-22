import { enqueueWithDedup } from "@/workers/queue";
import { getSharedRedis } from "@/server/redis";

/**
 * Enfileira classificação de uma conversa, deduplicando por `conversationId` em
 * janela de 30s.
 *
 * Sem dedup, um burst de 10 mensagens em 5s enfileira 10 jobs OpenAI para a
 * mesma conversa — multiplica custo por N. Com 30s de janela, o último estado
 * da conversa é classificado uma vez por janela; mensagens subsequentes ficam
 * fora do dedup mas o resultado é equivalente (classifier vê o estado mais
 * recente da conversa de qualquer forma).
 */
export async function enqueueConversationClassification(input: {
  tenantId: string;
  conversationId: string;
}): Promise<void> {
  if (!process.env.REDIS_URL) return;
  const redis = getSharedRedis();
  try {
    await enqueueWithDedup(
      redis,
      {
        type: "classify_conversation",
        tenantId: input.tenantId,
        conversationId: input.conversationId,
      },
      {
        dedupKey: `classify:${input.tenantId}:${input.conversationId}`,
        dedupTtlSec: 30,
      }
    );
  } catch (error) {
    console.warn(
      "[ai] falha ao enfileirar classificação",
      error instanceof Error ? error.message : error
    );
  }
  // Não fechar a conexão — é o singleton compartilhado.
}
