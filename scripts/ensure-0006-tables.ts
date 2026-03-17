/**
 * Garante que as tabelas da migração 0006 existem: onboarding_steps, tenant_onboarding_progress,
 * pagespeed_results, complaints, tenant_assets. Use se aparecerem erros de relação inexistente.
 * Uso: npx tsx scripts/ensure-0006-tables.ts
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
      CREATE TABLE IF NOT EXISTS "onboarding_steps" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "slug" varchar(64) NOT NULL UNIQUE,
        "name" varchar(255) NOT NULL,
        "description" varchar(512),
        "sort_order" integer NOT NULL DEFAULT 0
      );
    `);

    await sql.unsafe(`
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
    `);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "tenant_onboarding_tenant_idx" ON "tenant_onboarding_progress" USING btree ("tenant_id");`);
    await sql.unsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "tenant_onboarding_tenant_step_unique"
      ON "tenant_onboarding_progress" USING btree ("tenant_id", "onboarding_step_id");
    `);

    await sql.unsafe(`
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
    `);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "pagespeed_results_tenant_idx" ON "pagespeed_results" USING btree ("tenant_id");`);
    await sql.unsafe(`
      CREATE INDEX IF NOT EXISTS "pagespeed_results_tenant_url_strategy_idx"
      ON "pagespeed_results" USING btree ("tenant_id", "url", "strategy");
    `);
    await sql.unsafe(`ALTER TABLE "pagespeed_results" ADD COLUMN IF NOT EXISTS "metric_date" date;`);

    await sql.unsafe(`
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
    `);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "complaints_tenant_idx" ON "complaints" USING btree ("tenant_id");`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "complaints_status_idx" ON "complaints" USING btree ("status");`);

    await sql.unsafe(`
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
    `);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "tenant_assets_tenant_idx" ON "tenant_assets" USING btree ("tenant_id");`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "tenant_assets_tenant_kind_idx" ON "tenant_assets" USING btree ("tenant_id", "kind");`);

    await sql.unsafe(`
      INSERT INTO "onboarding_steps" ("id", "slug", "name", "description", "sort_order")
      VALUES
        (gen_random_uuid(), 'conectar-google-ads', 'Conectar Google Ads', 'Vincule sua conta Google Ads para acompanhar campanhas e conversões.', 10),
        (gen_random_uuid(), 'cadastrar-primeiro-lead', 'Cadastrar primeiro lead', 'Importe ou capture seu primeiro lead para começar o funil.', 20),
        (gen_random_uuid(), 'configurar-perfil', 'Configurar perfil', 'Preencha dados da empresa e do seu perfil em Configurações.', 30),
        (gen_random_uuid(), 'configurar-funil', 'Configurar funil', 'Defina as etapas do seu funil de vendas.', 40),
        (gen_random_uuid(), 'revisar-produtos', 'Revisar produtos', 'Cadastre produtos e defina se são pagamento único ou recorrente (MRR).', 50)
      ON CONFLICT ("slug") DO NOTHING;
    `);

    console.log("Tabelas da migração 0006 (onboarding_steps, tenant_onboarding_progress, pagespeed_results, complaints, tenant_assets) verificadas/criadas.");
  } catch (err) {
    console.error("Erro:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
