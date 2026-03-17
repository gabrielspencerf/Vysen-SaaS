/**
 * Garante que a tabela contacts existe (e coluna contact_id em conversations).
 * Use se o erro "não existe a relação 'contacts'" persistir.
 * Usa o mesmo DATABASE_URL do .env. Uso: npx tsx scripts/ensure-contacts-table.ts
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
    `);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "contacts_tenant_idx" ON "contacts" USING btree ("tenant_id");`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "contacts_tenant_phone_idx" ON "contacts" USING btree ("tenant_id", "normalized_phone");`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "contacts_tenant_email_idx" ON "contacts" USING btree ("tenant_id", "normalized_email");`);
    await sql.unsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "contacts_tenant_normalized_phone_unique"
        ON "contacts" USING btree ("tenant_id", "normalized_phone")
        WHERE normalized_phone IS NOT NULL AND normalized_phone != '';
    `);
    await sql.unsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "contacts_tenant_normalized_email_unique"
        ON "contacts" USING btree ("tenant_id", "normalized_email")
        WHERE normalized_email IS NOT NULL AND normalized_email != '';
    `);

    await sql.unsafe(`
      ALTER TABLE "conversations"
      ADD COLUMN IF NOT EXISTS "contact_id" uuid;
    `);
    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'conversations_contact_id_contacts_id_fk'
        ) THEN
          ALTER TABLE "conversations"
          ADD CONSTRAINT "conversations_contact_id_contacts_id_fk"
          FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
    await sql.unsafe(`
      CREATE INDEX IF NOT EXISTS "conversations_contact_id_idx"
      ON "conversations" USING btree ("contact_id");
    `);

    console.log("Tabela contacts e coluna conversations.contact_id verificadas/criadas.");
  } catch (err) {
    console.error("Erro:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
