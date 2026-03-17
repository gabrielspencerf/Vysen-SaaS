import { index, integer, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { tenants } from "../auth/tenants";

/** Tipo de asset: logo da empresa, foto, documento */
export const tenantAssetKindEnum = ["logo", "photo", "document"] as const;

/**
 * Arquivos enviados pelo tenant (logo, fotos da empresa). Armazenamento em disco/cloud; aqui só metadados.
 */
export const tenantAssets = pgTable(
  "tenant_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** logo | photo | document */
    kind: varchar("kind", { length: 32 }).notNull(),
    /** Caminho ou key no storage (filesystem/S3/Blob) */
    fileKey: varchar("file_key", { length: 512 }).notNull(),
    displayName: varchar("display_name", { length: 255 }),
    contentType: varchar("content_type", { length: 128 }),
    fileSizeBytes: integer("file_size_bytes"),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    tenant_assets_tenant_idx: index("tenant_assets_tenant_idx").on(t.tenantId),
    tenant_assets_tenant_kind_idx: index("tenant_assets_tenant_kind_idx").on(
      t.tenantId,
      t.kind
    ),
  })
);
