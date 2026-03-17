/**
 * Garante que as tabelas opportunities e user_profiles existem (migração 0005).
 * Use se os erros "não existe a relação 'opportunities'" ou "user_profiles" aparecerem.
 * Requer que contacts já exista (execute ensure-contacts-table.ts antes se necessário).
 * Uso: npx tsx scripts/ensure-0005-remaining.ts
 */
import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida. Configure em .env ou .env.local");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function main() {
  try {
    await sql.unsafe(`
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
    `);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "opportunities_tenant_idx" ON "opportunities" USING btree ("tenant_id");`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "opportunities_lead_idx" ON "opportunities" USING btree ("lead_id");`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "opportunities_contact_idx" ON "opportunities" USING btree ("contact_id");`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "opportunities_conversation_idx" ON "opportunities" USING btree ("conversation_id");`);

    await sql.unsafe(`ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "contact_started_at" timestamp (6) with time zone;`);
    await sql.unsafe(`ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "contracted_model" varchar(128);`);
    await sql.unsafe(`ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "job_value" numeric(12, 2);`);

    await sql.unsafe(`
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
    `);

    console.log("Tabelas opportunities e user_profiles verificadas/criadas.");
  } catch (err) {
    console.error("Erro:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
