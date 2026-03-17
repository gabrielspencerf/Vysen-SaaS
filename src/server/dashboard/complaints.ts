/**
 * Reclamações do cliente (tenant) sobre o serviço.
 */

import { desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { complaints } from "@/db/schema";

export interface ComplaintRow {
  id: string;
  tenantId: string;
  userId: string;
  subject: string | null;
  body: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function listComplaintsForTenant(
  tenantId: string,
  limit = 50
): Promise<ComplaintRow[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(complaints)
    .where(eq(complaints.tenantId, tenantId))
    .orderBy(desc(complaints.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    userId: r.userId,
    subject: r.subject,
    body: r.body,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function createComplaintForTenant(
  tenantId: string,
  userId: string,
  input: { subject?: string | null; body: string }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const db = getDb();
  const body = input.body?.trim();
  if (!body) return { ok: false, error: "O texto da reclamação é obrigatório." };
  const [inserted] = await db
    .insert(complaints)
    .values({
      tenantId,
      userId,
      subject: input.subject?.trim() ?? null,
      body,
    })
    .returning({ id: complaints.id });
  if (!inserted) return { ok: false, error: "Falha ao registrar reclamação" };
  return { ok: true, id: inserted.id };
}
