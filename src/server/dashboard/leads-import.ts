/**
 * Importação em lote de leads a partir de linhas CSV (objeto com chaves normalizadas).
 * Retorna created, skipped (duplicados) e errors por linha.
 */

import { and, eq, or } from "drizzle-orm";
import { getDb } from "@/server/db";
import { leads } from "@/db/schema";

const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "converted",
  "lost",
  "duplicate",
  "bad_lead",
] as const;

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

export interface CsvLeadRow {
  nome?: string;
  email?: string;
  telefone?: string;
  status?: string;
  origem?: string;
  observacoes?: string;
}

export interface ImportLeadResult {
  created: number;
  skipped: number;
  errors: { line: number; message: string }[];
}

/**
 * Importa leads a partir de linhas CSV. Ao menos um de email ou telefone por linha.
 * Duplicatas (mesmo normalized_email ou normalized_phone no tenant) são ignoradas (skipped).
 */
export async function importLeadsFromCsv(
  tenantId: string,
  rows: CsvLeadRow[]
): Promise<ImportLeadResult> {
  const db = getDb();
  const result: ImportLeadResult = { created: 0, skipped: 0, errors: [] };
  const now = new Date();

  for (let i = 0; i < rows.length; i++) {
    const line = i + 2; // 1-based + header
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

    let status: (typeof LEAD_STATUSES)[number] = "new";
    if (row.status) {
      const s = row.status.trim().toLowerCase();
      if (LEAD_STATUSES.includes(s as (typeof LEAD_STATUSES)[number])) {
        status = s as (typeof LEAD_STATUSES)[number];
      }
    }

    const name = row.nome?.trim() || null;
    const metadata: Record<string, unknown> = {};
    if (row.origem) metadata.origem = row.origem.trim();
    if (row.observacoes) metadata.observacoes = row.observacoes.trim();

    try {
      const orConditions = [
        ...(normalizedEmail ? [eq(leads.normalizedEmail, normalizedEmail)] : []),
        ...(normalizedPhone ? [eq(leads.normalizedPhone, normalizedPhone)] : []),
      ];
      const existing =
        orConditions.length > 0
          ? await db
              .select({ id: leads.id })
              .from(leads)
              .where(and(eq(leads.tenantId, tenantId), or(...orConditions)))
              .limit(1)
          : [];

      if (existing.length > 0) {
        result.skipped += 1;
        continue;
      }

      await db.insert(leads).values({
        tenantId,
        status,
        sourceIntegrationId: null,
        sourceProvider: null,
        sourceExternalId: null,
        email: email ?? null,
        normalizedEmail,
        name,
        phone: phone ?? null,
        normalizedPhone,
        firstSeenAt: now,
        lastSeenAt: now,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
      });
      result.created += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao inserir lead";
      result.errors.push({ line, message: msg });
    }
  }

  return result;
}
