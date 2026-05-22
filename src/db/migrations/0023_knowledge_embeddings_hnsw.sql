-- Substitui IVFFlat (lists=100) por HNSW em knowledge_embeddings.embedding.
--
-- Por que HNSW:
-- - IVFFlat com lists=100 é pior que sequential scan para <10k vetores e exige
--   ANALYZE/REINDEX para acompanhar o crescimento. Bom para datasets enormes
--   bem analisados, mas overhead alto para uso RAG médio.
-- - HNSW dá recall consistente independente do tamanho do dataset, sem precisar
--   ajustar `lists` conforme o volume cresce. m=16 / ef_construction=64 são
--   defaults equilibrados pra RAG.
-- - Tradeoff: HNSW usa mais memória durante build e tem inserts mais lentos,
--   mas em RAG insere uma vez por documento e busca centenas de vezes.
--
-- Idempotente: DROP IF EXISTS antes do CREATE. Só roda se a tabela existir
-- (pgvector pode estar off em ambiente sem extensão).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'knowledge_embeddings'
  ) THEN
    DROP INDEX IF EXISTS "knowledge_embeddings_vector_idx";
    BEGIN
      CREATE INDEX "knowledge_embeddings_vector_idx"
      ON "knowledge_embeddings" USING hnsw ("embedding" vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);
    EXCEPTION WHEN feature_not_supported OR undefined_object THEN
      -- HNSW exige pgvector >= 0.5.0. Em runtimes legados, mantém sem índice;
      -- a query continua funcionando via sequential scan.
      RAISE NOTICE 'HNSW indisponível (pgvector < 0.5); knowledge_embeddings_vector_idx pulado.';
    END;
  END IF;
END $$;
