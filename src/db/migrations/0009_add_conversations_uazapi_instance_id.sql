-- Garante que a coluna uazapi_instance_id existe em conversations (idempotente).
-- Útil quando a 0004 já foi marcada como aplicada mas a coluna não existe no banco.

ALTER TABLE "conversations"
  ADD COLUMN IF NOT EXISTS "uazapi_instance_id" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversations_uazapi_instance_id_uazapi_instances_id_fk'
  ) THEN
    ALTER TABLE "conversations"
    ADD CONSTRAINT "conversations_uazapi_instance_id_uazapi_instances_id_fk"
    FOREIGN KEY ("uazapi_instance_id") REFERENCES "public"."uazapi_instances"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "conversations_uazapi_instance_idx"
ON "conversations" USING btree ("uazapi_instance_id");
