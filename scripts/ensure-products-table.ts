/**
 * Garante que a tabela products existe (migrações 0006 + 0007).
 * Use se o erro "não existe a relação 'products'" aparecer.
 * Uso: npx tsx scripts/ensure-products-table.ts
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
    `);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "products_tenant_idx" ON "products" USING btree ("tenant_id");`);

    await sql.unsafe(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "billing_type" varchar(32) NOT NULL DEFAULT 'one_time';`);
    await sql.unsafe(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "billing_interval" varchar(16);`);

    console.log("Tabela products verificada/criada.");
  } catch (err) {
    console.error("Erro:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
