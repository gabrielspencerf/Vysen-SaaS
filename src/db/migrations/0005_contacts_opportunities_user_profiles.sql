-- Contatos (por tenant; criados por conversa, manual ou importação)
CREATE TABLE IF NOT EXISTS "contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" varchar(255),
  "email" varchar(255),
  "phone" varchar(64),
  "normalized_email" varchar(255),
  "normalized_phone" varchar(64),
  "source" varchar(32) NOT NULL DEFAULT 'manual',
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "contacts_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "contacts_tenant_idx" ON "contacts" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "contacts_tenant_phone_idx" ON "contacts" USING btree ("tenant_id", "normalized_phone");
CREATE INDEX IF NOT EXISTS "contacts_tenant_email_idx" ON "contacts" USING btree ("tenant_id", "normalized_email");
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_tenant_normalized_phone_unique"
  ON "contacts" USING btree ("tenant_id", "normalized_phone")
  WHERE normalized_phone IS NOT NULL AND normalized_phone != '';
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_tenant_normalized_email_unique"
  ON "contacts" USING btree ("tenant_id", "normalized_email")
  WHERE normalized_email IS NOT NULL AND normalized_email != '';

-- Oportunidades (lead e/ou contato; pode referenciar conversa)
CREATE TABLE IF NOT EXISTS "opportunities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "lead_id" uuid,
  "contact_id" uuid,
  "conversation_id" uuid,
  "stage" varchar(64) NOT NULL DEFAULT 'open',
  "title" varchar(255),
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "opportunities_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "opportunities_lead_id_leads_id_fk"
    FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "opportunities_contact_id_contacts_id_fk"
    FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "opportunities_conversation_id_conversations_id_fk"
    FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "opportunities_tenant_idx" ON "opportunities" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "opportunities_lead_idx" ON "opportunities" USING btree ("lead_id");
CREATE INDEX IF NOT EXISTS "opportunities_contact_idx" ON "opportunities" USING btree ("contact_id");
CREATE INDEX IF NOT EXISTS "opportunities_conversation_idx" ON "opportunities" USING btree ("conversation_id");

-- Perfil estendido do usuário (empresa, telefone, cargo, etc.)
CREATE TABLE IF NOT EXISTS "user_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL UNIQUE,
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
  CONSTRAINT "user_profiles_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);

-- Conversas: vínculo opcional com contato
ALTER TABLE "conversations"
  ADD COLUMN IF NOT EXISTS "contact_id" uuid
  CONSTRAINT "conversations_contact_id_contacts_id_fk"
  REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "conversations_contact_id_idx"
  ON "conversations" USING btree ("contact_id");
