/**
 * Listagem de contatos por tenant. Uso em páginas do dashboard; tenant sempre da sessão.
 */

import { and, desc, eq, ilike, or } from "drizzle-orm";
import { getDb } from "@/server/db";
import { contacts } from "@/db/schema";

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
