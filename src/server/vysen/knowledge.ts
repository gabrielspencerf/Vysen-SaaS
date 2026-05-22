import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { getGlobalOpenAIAgentApiKeyOnly } from "@/server/config/openai-agent";
import { writeAuditLog } from "@/server/audit/log";

const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const MAX_CHUNK_CHARS = 1400;
const CHUNK_OVERLAP_CHARS = 180;

export type KnowledgeScope = "global" | "tenant";

export interface KnowledgeIngestInput {
  scope: KnowledgeScope;
  tenantId?: string | null;
  title: string;
  sourceType: string;
  sourceUri?: string | null;
  content: string;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
}

export interface KnowledgeSearchInput {
  query: string;
  scope: KnowledgeScope;
  tenantId?: string | null;
  limit?: number;
}

export interface KnowledgeSearchResult {
  chunkId: string;
  documentId: string;
  title: string;
  content: string;
  sourceType: string;
  sourceUri: string | null;
  score: number;
}

function normalizeSpace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function splitIntoChunks(content: string): string[] {
  const normalized = content.trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < normalized.length) {
    const end = Math.min(normalized.length, cursor + MAX_CHUNK_CHARS);
    const chunk = normalizeSpace(normalized.slice(cursor, end));
    if (chunk.length > 0) chunks.push(chunk);
    if (end >= normalized.length) break;
    cursor = Math.max(0, end - CHUNK_OVERLAP_CHARS);
  }
  return chunks;
}

async function createEmbedding(input: { apiKey: string; text: string; model?: string }) {
  const response = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model ?? DEFAULT_EMBEDDING_MODEL,
      input: input.text,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Erro ao gerar embedding (${response.status}): ${body.slice(0, 180)}`);
  }
  const data = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
    model?: string;
  };
  const embedding = data.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("Embedding inválido recebido da OpenAI.");
  }
  return {
    embedding,
    model: data.model ?? input.model ?? DEFAULT_EMBEDDING_MODEL,
  };
}

function toPgVectorLiteral(values: number[]) {
  return `[${values.map((n) => Number(n.toFixed(8))).join(",")}]`;
}

export async function ingestKnowledgeDocument(input: KnowledgeIngestInput) {
  const db = getDb();
  const apiKey = await getGlobalOpenAIAgentApiKeyOnly();
  if (!apiKey) {
    throw new Error("OpenAI API key não configurada para embeddings.");
  }
  const chunks = splitIntoChunks(input.content);
  if (chunks.length === 0) {
    throw new Error("Conteúdo vazio para ingestão.");
  }

  const scope = input.scope;
  const tenantId = scope === "tenant" ? input.tenantId ?? null : null;
  if (scope === "tenant" && !tenantId) {
    throw new Error("tenantId é obrigatório para escopo tenant.");
  }

  const documentRows = (await db.execute<{ id: string }>(sql`
    INSERT INTO knowledge_documents (
      tenant_id, scope, title, source_type, source_uri, content, metadata, created_by
    ) VALUES (
      ${tenantId}, ${scope}, ${input.title.trim()}, ${input.sourceType.trim()},
      ${input.sourceUri ?? null}, ${input.content}, ${input.metadata ?? null}, ${input.createdBy ?? null}
    )
    RETURNING id
  `)) as unknown as { id: string }[];
  const documentId = documentRows[0]?.id;
  if (!documentId) throw new Error("Falha ao criar documento de conhecimento.");

  let embeddedCount = 0;
  for (let index = 0; index < chunks.length; index++) {
    const chunkContent = chunks[index];
    const chunkRows = (await db.execute<{ id: string }>(sql`
      INSERT INTO knowledge_chunks (
        document_id, tenant_id, scope, chunk_index, content, token_count, metadata
      ) VALUES (
        ${documentId}, ${tenantId}, ${scope}, ${index}, ${chunkContent},
        ${Math.ceil(chunkContent.length / 4)}, ${input.metadata ?? null}
      )
      RETURNING id
    `)) as unknown as { id: string }[];
    const chunkId = chunkRows[0]?.id;
    if (!chunkId) continue;

    const { embedding, model } = await createEmbedding({ apiKey, text: chunkContent });
    const vectorLiteral = toPgVectorLiteral(embedding);
    await db.execute(sql`
      INSERT INTO knowledge_embeddings (
        chunk_id, tenant_id, scope, embedding, model
      ) VALUES (
        ${chunkId}, ${tenantId}, ${scope}, ${vectorLiteral}::vector, ${model}
      )
    `);
    embeddedCount += 1;
  }

  await writeAuditLog({
    userId: input.createdBy ?? null,
    tenantId,
    action: "create",
    resourceType: "vysen_knowledge_document",
    resourceId: documentId,
    newValues: {
      scope,
      title: input.title,
      sourceType: input.sourceType,
      chunks: chunks.length,
      embeddedCount,
    },
  });

  return {
    documentId,
    chunks: chunks.length,
    embeddedCount,
  };
}

export async function searchKnowledge(input: KnowledgeSearchInput): Promise<KnowledgeSearchResult[]> {
  const db = getDb();
  const apiKey = await getGlobalOpenAIAgentApiKeyOnly();
  if (!apiKey) return [];
  const query = normalizeSpace(input.query);
  if (!query) return [];
  const scope = input.scope;
  const tenantId = scope === "tenant" ? input.tenantId ?? null : null;
  if (scope === "tenant" && !tenantId) {
    return [];
  }
  const limit = Math.max(1, Math.min(12, Math.floor(input.limit ?? 6)));

  const { embedding } = await createEmbedding({
    apiKey,
    text: query,
  });
  const vectorLiteral = toPgVectorLiteral(embedding);
  // Filtro por escopo separado em dois caminhos. O caminho global EXIGE tenant_id IS NULL —
  // assim um doc tenant marcado erroneamente como scope='global' nunca vaza em buscas globais.
  const scopeFilter =
    scope === "global"
      ? sql`kd.scope = 'global' AND kd.tenant_id IS NULL`
      : sql`kd.scope = 'tenant' AND kd.tenant_id = ${tenantId}`;
  const rows = (await db.execute<{
    chunkId: string;
    documentId: string;
    title: string;
    content: string;
    sourceType: string;
    sourceUri: string | null;
    distance: number;
  }>(sql`
    SELECT
      kc.id AS "chunkId",
      kd.id AS "documentId",
      kd.title AS "title",
      kc.content AS "content",
      kd.source_type AS "sourceType",
      kd.source_uri AS "sourceUri",
      (ke.embedding <=> ${vectorLiteral}::vector) AS "distance"
    FROM knowledge_embeddings ke
    INNER JOIN knowledge_chunks kc ON kc.id = ke.chunk_id
    INNER JOIN knowledge_documents kd ON kd.id = kc.document_id
    WHERE kd.is_active = true
      AND ${scopeFilter}
    ORDER BY ke.embedding <=> ${vectorLiteral}::vector
    LIMIT ${limit}
  `)) as unknown as Array<{
    chunkId: string;
    documentId: string;
    title: string;
    content: string;
    sourceType: string;
    sourceUri: string | null;
    distance: number;
  }>;

  return rows.map((row) => ({
    chunkId: row.chunkId,
    documentId: row.documentId,
    title: row.title,
    content: row.content,
    sourceType: row.sourceType,
    sourceUri: row.sourceUri,
    score: Math.max(0, Math.min(1, 1 - Number(row.distance ?? 1))),
  }));
}

export async function getKnowledgeHealth() {
  const db = getDb();
  const rows = (await db.execute<{
    scope: string;
    docs: string;
    chunks: string;
    embeddings: string;
  }>(sql`
    SELECT
      kd.scope AS scope,
      count(DISTINCT kd.id)::text AS docs,
      count(DISTINCT kc.id)::text AS chunks,
      count(DISTINCT ke.id)::text AS embeddings
    FROM knowledge_documents kd
    LEFT JOIN knowledge_chunks kc ON kc.document_id = kd.id
    LEFT JOIN knowledge_embeddings ke ON ke.chunk_id = kc.id
    WHERE kd.is_active = true
    GROUP BY kd.scope
  `)) as unknown as Array<{
    scope: string;
    docs: string;
    chunks: string;
    embeddings: string;
  }>;

  return rows.map((row) => ({
    scope: row.scope,
    docs: Number(row.docs ?? 0),
    chunks: Number(row.chunks ?? 0),
    embeddings: Number(row.embeddings ?? 0),
  }));
}

