/**
 * Importação em lote de contatos a partir de linhas CSV.
 * Retorna created, skipped (duplicados) e errors por linha.
 */

import { and, eq, or } from "drizzle-orm";
import { getDb } from "@/server/db";
import { contacts } from "@/db/schema";

function normalizeEmail(value: string | null | undefined): string | null {
  if (value == null || typeof value !== "string") return null;
  const t = value.trim();
  return t === "" ? null : t.toLowerCase();
}

function normalizePhone(value: string | null | undefined): string | null {
  if (value == null || typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return digits === "" ? null : digits;
}

export interface CsvContactRow {
  nome?: string;
  email?: string;
  telefone?: string;
  origem?: string;
  observacoes?: string;
}

export interface ImportContactResult {
  created: number;
  skipped: number;
  errors: { line: number; message: string }[];
}

/**
 * Importa contatos a partir de linhas CSV. Ao menos um de email ou telefone por linha.
 * Duplicatas (mesmo normalized_email ou normalized_phone no tenant) são ignoradas (skipped).
 */
export async function importContactsFromCsv(
  tenantId: string,
  rows: CsvContactRow[]
): Promise<ImportContactResult> {
  const db = getDb();
  const result: ImportContactResult = { created: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const line = i + 2;
    const row = rows[i];
    const email = row.email?.trim() || null;
    const phone = row.telefone?.trim() || null;
    const normalizedEmail = email ? normalizeEmail(email) : null;
    const normalizedPhone = phone ? normalizePhone(phone) : null;

    if (!normalizedEmail && !normalizedPhone) {
      result.errors.push({
        line,
        message: "É necessário ao menos e-mail ou telefone",
      });
      continue;
    }

    const name = row.nome?.trim() || null;
    const source = row.origem?.trim() === "manual" ? "manual" : "import";

    try {
      const orConditions = [
        ...(normalizedEmail ? [eq(contacts.normalizedEmail, normalizedEmail)] : []),
        ...(normalizedPhone ? [eq(contacts.normalizedPhone, normalizedPhone)] : []),
      ];
      const existing =
        orConditions.length > 0
          ? await db
              .select({ id: contacts.id })
              .from(contacts)
              .where(and(eq(contacts.tenantId, tenantId), or(...orConditions)))
              .limit(1)
          : [];

      if (existing.length > 0) {
        result.skipped += 1;
        continue;
      }

      await db.insert(contacts).values({
        tenantId,
        name,
        email: email ?? null,
        normalizedEmail,
        phone: phone ?? null,
        normalizedPhone,
        source,
      });
      result.created += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao inserir contato";
      result.errors.push({ line, message: msg });
    }
  }

  return result;
}
