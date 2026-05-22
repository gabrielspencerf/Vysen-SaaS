/**
 * CRUD de contatos por tenant. Uso em páginas do dashboard; tenant sempre da sessão.
 */

import { and, desc, eq, ilike, or } from "drizzle-orm";
import { getDb } from "@/server/db";
import { contacts } from "@/db/schema";
import { writeAuditLog } from "@/server/audit/log";

function normalizeEmail(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = String(value).trim();
  return t === "" ? null : t.toLowerCase();
}

function normalizePhone(value: string | null | undefined): string | null {
  if (value == null) return null;
  const digits = String(value).replace(/\D/g, "");
  return digits === "" ? null : digits;
}

export interface ContactRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListContactsOptions {
  search?: string;
  limit?: number;
}

/**
 * Lista contatos do tenant ordenados por updated_at desc.
 * search: busca em name, email ou phone (ilike %search%).
 */
export async function listContactsForTenant(
  tenantId: string,
  options: ListContactsOptions = {}
): Promise<ContactRow[]> {
  const db = getDb();
  const { search, limit = 200 } = options;

  const term = search?.trim();
  const whereClause = term
    ? and(
        eq(contacts.tenantId, tenantId),
        or(
          ilike(contacts.name, `%${term}%`),
          ilike(contacts.email, `%${term}%`),
          ilike(contacts.phone, `%${term}%`)
        )
      )
    : eq(contacts.tenantId, tenantId);

  const rows = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      phone: contacts.phone,
      source: contacts.source,
      createdAt: contacts.createdAt,
      updatedAt: contacts.updatedAt,
    })
    .from(contacts)
    .where(whereClause)
    .orderBy(desc(contacts.updatedAt))
    .limit(limit);

  return rows;
}

export interface CreateContactInput {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string;
  actorUserId?: string | null;
}

export async function createContactForTenant(
  tenantId: string,
  input: CreateContactInput
): Promise<{ ok: true; id: string } | { ok: false; error: "invalid" | "conflict" }> {
  const trimmedName = input.name?.trim() || null;
  const normalizedEmail = normalizeEmail(input.email ?? null);
  const normalizedPhone = normalizePhone(input.phone ?? null);
  if (!trimmedName && !normalizedEmail && !normalizedPhone) {
    return { ok: false, error: "invalid" };
  }
  const db = getDb();
  try {
    const [inserted] = await db
      .insert(contacts)
      .values({
        tenantId,
        name: trimmedName,
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        normalizedEmail,
        normalizedPhone,
        source: input.source ?? "manual",
      })
      .returning({ id: contacts.id });
    if (!inserted) return { ok: false, error: "invalid" };
    await writeAuditLog({
      tenantId,
      userId: input.actorUserId ?? null,
      action: "create",
      resourceType: "contact",
      resourceId: inserted.id,
      newValues: {
        name: trimmedName,
        email: normalizedEmail,
        phone: normalizedPhone,
      },
    });
    return { ok: true, id: inserted.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { ok: false, error: "conflict" };
    }
    throw err;
  }
}

export interface UpdateContactInput {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  actorUserId?: string | null;
}

export async function updateContactForTenant(
  tenantId: string,
  contactId: string,
  input: UpdateContactInput
): Promise<{ ok: true } | { ok: false; error: "not_found" | "conflict" }> {
  const db = getDb();
  const [existing] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, contactId)))
    .limit(1);
  if (!existing) return { ok: false, error: "not_found" };

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name?.trim() || null;
  if (input.email !== undefined) {
    updates.email = input.email?.trim() || null;
    updates.normalizedEmail = normalizeEmail(input.email);
  }
  if (input.phone !== undefined) {
    updates.phone = input.phone?.trim() || null;
    updates.normalizedPhone = normalizePhone(input.phone);
  }
  if (Object.keys(updates).length === 0) return { ok: true };
  updates.updatedAt = new Date();

  try {
    await db
      .update(contacts)
      .set(updates as Partial<typeof contacts.$inferInsert>)
      .where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, contactId)));
    await writeAuditLog({
      tenantId,
      userId: input.actorUserId ?? null,
      action: "update",
      resourceType: "contact",
      resourceId: contactId,
      newValues: updates,
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { ok: false, error: "conflict" };
    }
    throw err;
  }
}

export async function deleteContactForTenant(
  tenantId: string,
  contactId: string,
  actorUserId: string | null
): Promise<{ ok: true } | { ok: false; error: "not_found" }> {
  const db = getDb();
  const [existing] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, contactId)))
    .limit(1);
  if (!existing) return { ok: false, error: "not_found" };
  await db
    .delete(contacts)
    .where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, contactId)));
  await writeAuditLog({
    tenantId,
    userId: actorUserId,
    action: "delete",
    resourceType: "contact",
    resourceId: contactId,
  });
  return { ok: true };
}

export async function getContactByIdForTenant(
  tenantId: string,
  contactId: string
): Promise<ContactRow | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      phone: contacts.phone,
      source: contacts.source,
      createdAt: contacts.createdAt,
      updatedAt: contacts.updatedAt,
    })
    .from(contacts)
    .where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, contactId)))
    .limit(1);
  return row ?? null;
}
