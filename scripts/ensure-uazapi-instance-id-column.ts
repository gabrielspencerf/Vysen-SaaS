/**
 * Garante que a coluna uazapi_instance_id existe em conversations.
 * Use se o erro "não existe a coluna conversations.uazapi_instance_id" persistir.
 * Usa o mesmo DATABASE_URL do .env (mesmo banco da aplicação).
 * Uso: npx tsx scripts/ensure-uazapi-instance-id-column.ts
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
      ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS uazapi_instance_id uuid;
    `);
    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'conversations_uazapi_instance_id_uazapi_instances_id_fk'
        ) THEN
          ALTER TABLE conversations
          ADD CONSTRAINT conversations_uazapi_instance_id_uazapi_instances_id_fk
          FOREIGN KEY (uazapi_instance_id) REFERENCES public.uazapi_instances(id)
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
    await sql.unsafe(`
      CREATE INDEX IF NOT EXISTS conversations_uazapi_instance_idx
      ON conversations USING btree (uazapi_instance_id);
    `);
    console.log("Coluna conversations.uazapi_instance_id verificada/criada.");
  } catch (err) {
    console.error("Erro:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
