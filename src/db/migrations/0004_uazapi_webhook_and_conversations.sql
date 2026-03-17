-- UAZAPI: eventos de webhook e conversas por instância UAZAPI (paridade com Evolution)
-- Conversas passam a suportar OU evolution_instance_id OU uazapi_instance_id

-- Tabela de eventos brutos UAZAPI (espelho de evolution_webhook_events)
CREATE TABLE IF NOT EXISTS "uazapi_webhook_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "uazapi_instance_id" uuid NOT NULL,
  "external_event_id" varchar(255),
  "event_type" varchar(64) NOT NULL,
  "payload" jsonb NOT NULL,
  "received_at" timestamp (6) with time zone NOT NULL,
  "processed_at" timestamp (6) with time zone,
  "processing_error" varchar(1024),
  CONSTRAINT "uazapi_webhook_events_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "uazapi_webhook_events_uazapi_instance_id_uazapi_instances_id_fk"
    FOREIGN KEY ("uazapi_instance_id") REFERENCES "public"."uazapi_instances"("id") ON DELETE cascade ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "uazapi_webhook_events_tenant_received_idx"
ON "uazapi_webhook_events" USING btree ("tenant_id", "received_at");

CREATE INDEX IF NOT EXISTS "uazapi_webhook_events_instance_received_idx"
ON "uazapi_webhook_events" USING btree ("uazapi_instance_id", "received_at");

CREATE INDEX IF NOT EXISTS "uazapi_webhook_events_processed_idx"
ON "uazapi_webhook_events" USING btree ("processed_at");

CREATE UNIQUE INDEX IF NOT EXISTS "uazapi_webhook_events_dedup_unique"
ON "uazapi_webhook_events" USING btree ("tenant_id", "uazapi_instance_id", "external_event_id")
WHERE "uazapi_webhook_events"."external_event_id" IS NOT NULL;

-- Conversas: permitir Evolution OU UAZAPI (exatamente um)
ALTER TABLE "conversations"
  ALTER COLUMN "evolution_instance_id" DROP NOT NULL;

ALTER TABLE "conversations"
  ADD COLUMN IF NOT EXISTS "uazapi_instance_id" uuid
  CONSTRAINT "conversations_uazapi_instance_id_uazapi_instances_id_fk"
  REFERENCES "public"."uazapi_instances"("id") ON DELETE cascade ON UPDATE no action;

-- Garantir que exatamente um dos dois está preenchido
ALTER TABLE "conversations"
  DROP CONSTRAINT IF EXISTS "conversations_instance_check";

ALTER TABLE "conversations"
  ADD CONSTRAINT "conversations_instance_check"
  CHECK (
    ("evolution_instance_id" IS NOT NULL AND "uazapi_instance_id" IS NULL)
    OR ("evolution_instance_id" IS NULL AND "uazapi_instance_id" IS NOT NULL)
  );

-- Índice único por Evolution (conversas Evolution)
DROP INDEX IF EXISTS "conversations_tenant_instance_external_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "conversations_tenant_evolution_external_unique"
ON "conversations" USING btree ("tenant_id", "evolution_instance_id", "external_id")
WHERE "evolution_instance_id" IS NOT NULL;

-- Índice único por UAZAPI (conversas UAZAPI)
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_tenant_uazapi_external_unique"
ON "conversations" USING btree ("tenant_id", "uazapi_instance_id", "external_id")
WHERE "uazapi_instance_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "conversations_uazapi_instance_idx"
ON "conversations" USING btree ("uazapi_instance_id");
