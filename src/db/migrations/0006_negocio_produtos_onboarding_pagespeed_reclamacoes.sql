-- Oportunidades: data início contato, modelo contratado, valor do trabalho (ROAS/ROI)
ALTER TABLE "opportunities"
  ADD COLUMN IF NOT EXISTS "contact_started_at" timestamp (6) with time zone,
  ADD COLUMN IF NOT EXISTS "contracted_model" varchar(128),
  ADD COLUMN IF NOT EXISTS "job_value" numeric(12, 2);

-- Produtos do tenant (valor de ticket)
CREATE TABLE IF NOT EXISTS "products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" varchar(512),
  "unit_price" numeric(12, 2) NOT NULL,
  "currency" varchar(8) NOT NULL DEFAULT 'BRL',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "products_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "products_tenant_idx" ON "products" USING btree ("tenant_id");

-- Arquivos do tenant (logo, fotos)
CREATE TABLE IF NOT EXISTS "tenant_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "kind" varchar(32) NOT NULL,
  "file_key" varchar(512) NOT NULL,
  "display_name" varchar(255),
  "content_type" varchar(128),
  "file_size_bytes" integer,
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tenant_assets_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "tenant_assets_tenant_idx" ON "tenant_assets" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "tenant_assets_tenant_kind_idx" ON "tenant_assets" USING btree ("tenant_id", "kind");

-- Etapas mestres do onboarding (globais)
CREATE TABLE IF NOT EXISTS "onboarding_steps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" varchar(64) NOT NULL UNIQUE,
  "name" varchar(255) NOT NULL,
  "description" varchar(512),
  "sort_order" integer NOT NULL DEFAULT 0
);

-- Progresso de onboarding por tenant
CREATE TABLE IF NOT EXISTS "tenant_onboarding_progress" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "onboarding_step_id" uuid NOT NULL,
  "completed_at" timestamp (6) with time zone NOT NULL,
  CONSTRAINT "tenant_onboarding_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "tenant_onboarding_step_id_fk"
    FOREIGN KEY ("onboarding_step_id") REFERENCES "public"."onboarding_steps"("id") ON DELETE cascade ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "tenant_onboarding_tenant_idx" ON "tenant_onboarding_progress" USING btree ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_onboarding_tenant_step_unique"
  ON "tenant_onboarding_progress" USING btree ("tenant_id", "onboarding_step_id");

-- Cache PageSpeed Insights por tenant/URL/estratégia
CREATE TABLE IF NOT EXISTS "pagespeed_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "url" varchar(2048) NOT NULL,
  "strategy" varchar(16) NOT NULL,
  "result" jsonb NOT NULL,
  "fetched_at" timestamp (6) with time zone NOT NULL,
  CONSTRAINT "pagespeed_results_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "pagespeed_results_tenant_idx" ON "pagespeed_results" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "pagespeed_results_tenant_url_strategy_idx"
  ON "pagespeed_results" USING btree ("tenant_id", "url", "strategy");

-- Reclamações do cliente (tenant)
CREATE TABLE IF NOT EXISTS "complaints" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "subject" varchar(255),
  "body" text NOT NULL,
  "status" varchar(32) NOT NULL DEFAULT 'open',
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "complaints_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "complaints_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "complaints_tenant_idx" ON "complaints" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "complaints_status_idx" ON "complaints" USING btree ("status");
