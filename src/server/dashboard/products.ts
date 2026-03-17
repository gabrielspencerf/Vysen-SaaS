/**
 * Produtos do tenant: valor de ticket, recorrente ou único (MRR).
 */

import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { products } from "@/db/schema";

export interface ProductRow {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  unitPrice: string;
  currency: string;
  billingType: string;
  billingInterval: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function listProductsForTenant(
  tenantId: string,
  options: { activeOnly?: boolean } = {}
): Promise<ProductRow[]> {
  const db = getDb();
  const { activeOnly = false } = options;
  const where =
    activeOnly
      ? and(eq(products.tenantId, tenantId), eq(products.isActive, true))
      : eq(products.tenantId, tenantId);
  const rows = await db
    .select()
    .from(products)
    .where(where)
    .orderBy(desc(products.updatedAt));
  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    name: r.name,
    description: r.description,
    unitPrice: r.unitPrice,
    currency: r.currency,
    billingType: r.billingType ?? "one_time",
    billingInterval: r.billingInterval ?? null,
    isActive: r.isActive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

/**
 * Calcula MRR (Monthly Recurring Revenue) a partir dos produtos ativos recorrentes do tenant.
 * Mensal: unit_price; Anual: unit_price / 12.
 */
export async function computeMrrForTenant(tenantId: string): Promise<{
  mrr: number;
  currency: string;
}> {
  const db = getDb();
  const rows = await db
    .select({
      unitPrice: products.unitPrice,
      billingInterval: products.billingInterval,
      currency: products.currency,
    })
    .from(products)
    .where(
      and(
        eq(products.tenantId, tenantId),
        eq(products.isActive, true),
        eq(products.billingType, "recurring")
      )
    );
  let mrr = 0;
  const currency = rows[0]?.currency ?? "BRL";
  for (const r of rows) {
    const price = Number(r.unitPrice);
    if (r.billingInterval === "yearly") mrr += price / 12;
    else mrr += price; // monthly ou null tratado como mensal
  }
  return { mrr, currency };
}

export async function createProductForTenant(
  tenantId: string,
  input: {
    name: string;
    description?: string | null;
    unitPrice: string;
    currency?: string;
    billingType?: "one_time" | "recurring";
    billingInterval?: "monthly" | "yearly" | null;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const db = getDb();
  const billingType = input.billingType ?? "one_time";
  const billingInterval =
    billingType === "recurring"
      ? (input.billingInterval ?? "monthly")
      : null;
  const [inserted] = await db
    .insert(products)
    .values({
      tenantId,
      name: input.name.trim(),
      description: input.description?.trim() ?? null,
      unitPrice: input.unitPrice,
      currency: (input.currency ?? "BRL").trim(),
      billingType,
      billingInterval,
    })
    .returning({ id: products.id });
  if (!inserted) return { ok: false, error: "Falha ao criar produto" };
  return { ok: true, id: inserted.id };
}
