-- vysen_usage_events ganha campos de correlação e custo estimado.
--
-- Por que NÃO fazemos `tenant_id NOT NULL`: admin chat (super_admin global) opera
-- sem tenant — NULL é legítimo. O fix de cobertura está em fazer índices úteis
-- e enriquecer a telemetria com `request_id` (correlação cross-call) e
-- `estimated_cost_usd` (visibilidade de gasto).

-- request_id: amarra prompt embedding + thinking + fast fallback do mesmo
-- pedido HTTP em uma só janela observável.
ALTER TABLE "vysen_usage_events"
  ADD COLUMN IF NOT EXISTS "request_id" uuid;

-- estimated_cost_usd: preenchido pelo app a partir do model + token counts.
-- numeric(10,6) cobre até $9999.999999 — suficiente por evento.
ALTER TABLE "vysen_usage_events"
  ADD COLUMN IF NOT EXISTS "estimated_cost_usd" numeric(10, 6);

-- Índice parcial para queries de "uso por tenant" — ignora linhas platform-wide.
CREATE INDEX IF NOT EXISTS "vysen_usage_events_tenant_only_created_idx"
ON "vysen_usage_events" USING btree ("tenant_id", "created_at")
WHERE "tenant_id" IS NOT NULL;

-- Índice por request_id para reconstruir trace de um pedido.
CREATE INDEX IF NOT EXISTS "vysen_usage_events_request_idx"
ON "vysen_usage_events" USING btree ("request_id")
WHERE "request_id" IS NOT NULL;
