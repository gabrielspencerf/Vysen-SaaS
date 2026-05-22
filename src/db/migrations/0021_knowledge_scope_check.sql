-- CHECK constraints garantindo invariante (scope, tenant_id) em knowledge_*.
--
-- Antes desta migration, era possível ter docs/chunks/embeddings com
-- `scope = 'global'` mas `tenant_id` preenchido — caso em que uma busca global
-- vazaria conteúdo de um tenant. O fix no app já existe (vysen/knowledge.ts:198
-- separa branches), e este CHECK fecha o vetor no schema.
--
-- Invariante:
--   (scope = 'global' AND tenant_id IS NULL)
--   OR (scope = 'tenant' AND tenant_id IS NOT NULL)
--
-- Idempotente: usa DROP IF EXISTS antes do ADD para permitir re-aplicação.

-- Backfill defensivo: limpa tenant_id em docs marcados global e marca como
-- tenant qualquer doc que tenha tenant_id preenchido sem scope correto.
-- (NOOP se dados já estão consistentes.)
UPDATE "knowledge_documents"
SET "tenant_id" = NULL
WHERE "scope" = 'global' AND "tenant_id" IS NOT NULL;

UPDATE "knowledge_documents"
SET "scope" = 'tenant'
WHERE "tenant_id" IS NOT NULL AND "scope" <> 'tenant';

ALTER TABLE "knowledge_documents"
  DROP CONSTRAINT IF EXISTS "knowledge_documents_scope_tenant_check";
ALTER TABLE "knowledge_documents"
  ADD CONSTRAINT "knowledge_documents_scope_tenant_check" CHECK (
    ("scope" = 'global' AND "tenant_id" IS NULL)
    OR ("scope" = 'tenant' AND "tenant_id" IS NOT NULL)
  );

-- knowledge_chunks
UPDATE "knowledge_chunks"
SET "tenant_id" = NULL
WHERE "scope" = 'global' AND "tenant_id" IS NOT NULL;

UPDATE "knowledge_chunks"
SET "scope" = 'tenant'
WHERE "tenant_id" IS NOT NULL AND "scope" <> 'tenant';

ALTER TABLE "knowledge_chunks"
  DROP CONSTRAINT IF EXISTS "knowledge_chunks_scope_tenant_check";
ALTER TABLE "knowledge_chunks"
  ADD CONSTRAINT "knowledge_chunks_scope_tenant_check" CHECK (
    ("scope" = 'global' AND "tenant_id" IS NULL)
    OR ("scope" = 'tenant' AND "tenant_id" IS NOT NULL)
  );

-- knowledge_embeddings (só se a tabela existir — extensão pgvector pode estar off)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'knowledge_embeddings'
  ) THEN
    UPDATE "knowledge_embeddings"
    SET "tenant_id" = NULL
    WHERE "scope" = 'global' AND "tenant_id" IS NOT NULL;

    UPDATE "knowledge_embeddings"
    SET "scope" = 'tenant'
    WHERE "tenant_id" IS NOT NULL AND "scope" <> 'tenant';

    ALTER TABLE "knowledge_embeddings"
      DROP CONSTRAINT IF EXISTS "knowledge_embeddings_scope_tenant_check";
    ALTER TABLE "knowledge_embeddings"
      ADD CONSTRAINT "knowledge_embeddings_scope_tenant_check" CHECK (
        ("scope" = 'global' AND "tenant_id" IS NULL)
        OR ("scope" = 'tenant' AND "tenant_id" IS NOT NULL)
      );
  END IF;
END $$;
