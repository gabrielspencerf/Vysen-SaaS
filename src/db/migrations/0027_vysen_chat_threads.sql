-- Persistência server-side das threads do copilot Vysen.
-- Substitui localStorage (que ficava por device) por storage central.
CREATE TABLE IF NOT EXISTS "vysen_chat_threads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" varchar(255) NOT NULL,
  "context_area" varchar(64) NOT NULL DEFAULT 'geral',
  "summary" varchar(512) NOT NULL DEFAULT '',
  "contexts" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "messages" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "message_count" integer NOT NULL DEFAULT 0,
  "experience_started" boolean NOT NULL DEFAULT false,
  "created_at" timestamp (6) with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp (6) with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "vysen_chat_threads_user_idx"
  ON "vysen_chat_threads" ("tenant_id", "user_id", "updated_at" DESC);
