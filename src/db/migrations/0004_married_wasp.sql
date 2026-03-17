DO $$
BEGIN
 ALTER TYPE "provider_enum" ADD VALUE 'uazapi';
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"phone" varchar(64),
	"job_title" varchar(255),
	"company_name" varchar(255),
	"company_website" varchar(512),
	"company_phone" varchar(64),
	"company_address" varchar(512),
	"timezone" varchar(64),
	"avatar_url" varchar(512),
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_global_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(128) NOT NULL,
	"value_plain" text,
	"value_encrypted" text,
	"is_sensitive" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "app_global_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "complaints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"subject" varchar(255),
	"body" text NOT NULL,
	"status" varchar(32) DEFAULT 'open' NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "onboarding_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(512),
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "onboarding_steps_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pagespeed_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"url" varchar(2048) NOT NULL,
	"strategy" varchar(16) NOT NULL,
	"metric_date" date NOT NULL,
	"result" jsonb NOT NULL,
	"fetched_at" timestamp (6) with time zone NOT NULL,
	CONSTRAINT "pagespeed_results_tenant_url_strategy_date_unique" UNIQUE("tenant_id","url","strategy","metric_date")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" varchar(32) NOT NULL,
	"file_key" varchar(512) NOT NULL,
	"display_name" varchar(255),
	"content_type" varchar(128),
	"file_size_bytes" integer,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_onboarding_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"onboarding_step_id" uuid NOT NULL,
	"completed_at" timestamp (6) with time zone NOT NULL,
	CONSTRAINT "tenant_onboarding_tenant_step_unique" UNIQUE("tenant_id","onboarding_step_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "uazapi_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"external_id" varchar(64) NOT NULL,
	"base_url" varchar(512) NOT NULL,
	"api_key_encrypted" text,
	"instance_name" varchar(255),
	"last_synced_at" timestamp (6) with time zone,
	"last_status" varchar(64),
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uazapi_instances_tenant_external_unique" UNIQUE("tenant_id","external_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "uazapi_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"uazapi_instance_id" uuid NOT NULL,
	"external_event_id" varchar(255),
	"event_type" varchar(64) NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp (6) with time zone NOT NULL,
	"processed_at" timestamp (6) with time zone,
	"processing_error" varchar(1024)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255),
	"email" varchar(255),
	"phone" varchar(64),
	"normalized_email" varchar(255),
	"normalized_phone" varchar(64),
	"source" varchar(32) DEFAULT 'manual' NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid,
	"contact_id" uuid,
	"conversation_id" uuid,
	"stage" varchar(64) DEFAULT 'open' NOT NULL,
	"title" varchar(255),
	"contact_started_at" timestamp (6) with time zone,
	"contracted_model" varchar(128),
	"job_value" numeric(12, 2),
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(512),
	"unit_price" numeric(12, 2) NOT NULL,
	"currency" varchar(8) DEFAULT 'BRL' NOT NULL,
	"billing_type" varchar(32) DEFAULT 'one_time' NOT NULL,
	"billing_interval" varchar(16),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
 ALTER TABLE "conversations" DROP CONSTRAINT "conversations_tenant_instance_external_unique";
EXCEPTION
 WHEN undefined_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
 ALTER TABLE "conversations" ALTER COLUMN "evolution_instance_id" DROP NOT NULL;
EXCEPTION
 WHEN others THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
 ALTER TABLE "google_ads_accounts" ADD COLUMN "currency_code" varchar(8);
EXCEPTION
 WHEN duplicate_column THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
 ALTER TABLE "typebot_bots" ADD COLUMN "webhook_secret_encrypted" varchar(1024);
EXCEPTION
 WHEN duplicate_column THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
 ALTER TABLE "typebot_bots" ADD COLUMN "api_token_encrypted" varchar(1024);
EXCEPTION
 WHEN duplicate_column THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
 ALTER TABLE "typebot_bots" ADD COLUMN "metrics_api_base_url" varchar(512);
EXCEPTION
 WHEN duplicate_column THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
 ALTER TABLE "conversations" ADD COLUMN "contact_id" uuid;
EXCEPTION
 WHEN duplicate_column THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
 ALTER TABLE "conversations" ADD COLUMN "uazapi_instance_id" uuid;
EXCEPTION
 WHEN duplicate_column THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app_global_config" ADD CONSTRAINT "app_global_config_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "complaints" ADD CONSTRAINT "complaints_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "complaints" ADD CONSTRAINT "complaints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pagespeed_results" ADD CONSTRAINT "pagespeed_results_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tenant_assets" ADD CONSTRAINT "tenant_assets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tenant_onboarding_progress" ADD CONSTRAINT "tenant_onboarding_progress_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tenant_onboarding_progress" ADD CONSTRAINT "tenant_onboarding_progress_onboarding_step_id_onboarding_steps_id_fk" FOREIGN KEY ("onboarding_step_id") REFERENCES "public"."onboarding_steps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "uazapi_instances" ADD CONSTRAINT "uazapi_instances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "uazapi_webhook_events" ADD CONSTRAINT "uazapi_webhook_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "uazapi_webhook_events" ADD CONSTRAINT "uazapi_webhook_events_uazapi_instance_id_uazapi_instances_id_fk" FOREIGN KEY ("uazapi_instance_id") REFERENCES "public"."uazapi_instances"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_global_config_key_idx" ON "app_global_config" USING btree ("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "complaints_tenant_idx" ON "complaints" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "complaints_status_idx" ON "complaints" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pagespeed_results_tenant_idx" ON "pagespeed_results" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pagespeed_results_tenant_date_strategy_idx" ON "pagespeed_results" USING btree ("tenant_id","metric_date","strategy");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_assets_tenant_idx" ON "tenant_assets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_assets_tenant_kind_idx" ON "tenant_assets" USING btree ("tenant_id","kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_onboarding_tenant_idx" ON "tenant_onboarding_progress" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "uazapi_instances_tenant_external_idx" ON "uazapi_instances" USING btree ("tenant_id","external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "uazapi_webhook_events_tenant_received_idx" ON "uazapi_webhook_events" USING btree ("tenant_id","received_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "uazapi_webhook_events_instance_received_idx" ON "uazapi_webhook_events" USING btree ("uazapi_instance_id","received_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "uazapi_webhook_events_processed_idx" ON "uazapi_webhook_events" USING btree ("processed_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uazapi_webhook_events_dedup_unique" ON "uazapi_webhook_events" USING btree ("tenant_id","uazapi_instance_id","external_event_id") WHERE "uazapi_webhook_events"."external_event_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contacts_tenant_idx" ON "contacts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contacts_tenant_phone_idx" ON "contacts" USING btree ("tenant_id","normalized_phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contacts_tenant_email_idx" ON "contacts" USING btree ("tenant_id","normalized_email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_tenant_normalized_phone_unique" ON "contacts" USING btree ("tenant_id","normalized_phone") WHERE "contacts"."normalized_phone" IS NOT NULL AND "contacts"."normalized_phone" != '';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_tenant_normalized_email_unique" ON "contacts" USING btree ("tenant_id","normalized_email") WHERE "contacts"."normalized_email" IS NOT NULL AND "contacts"."normalized_email" != '';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunities_tenant_idx" ON "opportunities" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunities_lead_idx" ON "opportunities" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunities_contact_idx" ON "opportunities" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunities_conversation_idx" ON "opportunities" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_tenant_idx" ON "products" USING btree ("tenant_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_uazapi_instance_id_uazapi_instances_id_fk" FOREIGN KEY ("uazapi_instance_id") REFERENCES "public"."uazapi_instances"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "evolution_webhook_events_dedup_unique" ON "evolution_webhook_events" USING btree ("tenant_id","evolution_instance_id","external_event_id") WHERE "evolution_webhook_events"."external_event_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "typebot_webhook_events_dedup_unique" ON "typebot_webhook_events" USING btree ("tenant_id","typebot_bot_id","external_event_id") WHERE "typebot_webhook_events"."external_event_id" IS NOT NULL;