/**
 * Upload e listagem de arquivos do tenant (logo, fotos).
 * Armazenamento em disco em uploads/{tenantId}/{kind}/.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { tenantAssets } from "@/db/schema";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

const UPLOAD_DIR = "uploads";
const ALLOWED_KINDS = ["logo", "photo", "document"] as const;
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];

export interface TenantAssetRow {
  id: string;
  tenantId: string;
  kind: string;
  fileKey: string;
  displayName: string | null;
  contentType: string | null;
  fileSizeBytes: number | null;
  createdAt: Date;
}

export async function listTenantAssets(
  tenantId: string,
  options: { kind?: string } = {}
): Promise<TenantAssetRow[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(tenantAssets)
    .where(
      options.kind
        ? and(eq(tenantAssets.tenantId, tenantId), eq(tenantAssets.kind, options.kind))
        : eq(tenantAssets.tenantId, tenantId)
    );
  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    kind: r.kind,
    fileKey: r.fileKey,
    displayName: r.displayName,
    contentType: r.contentType,
    fileSizeBytes: r.fileSizeBytes,
    createdAt: r.createdAt,
  }));
}

function resolveSafePath(relativeKey: string): string | null {
  const uploadDir = path.resolve(process.cwd(), UPLOAD_DIR);
  const resolved = path.resolve(uploadDir, relativeKey);
  if (resolved !== uploadDir && !resolved.startsWith(uploadDir + path.sep)) {
    return null;
  }
  return resolved;
}

export async function createTenantAsset(
  tenantId: string,
  input: {
    kind: string;
    buffer: Buffer;
    contentType: string;
    originalName?: string;
    size: number;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!ALLOWED_KINDS.includes(input.kind as (typeof ALLOWED_KINDS)[number])) {
    return { ok: false, error: "Tipo inválido. Use: logo, photo ou document." };
  }
  if (input.size > MAX_SIZE_BYTES) {
    return { ok: false, error: "Arquivo muito grande. Máximo 5 MB." };
  }
  if (!ALLOWED_TYPES.includes(input.contentType)) {
    return { ok: false, error: "Tipo de arquivo não permitido (use imagem ou PDF)." };
  }

  const ext = input.contentType === "image/jpeg" ? "jpg" : input.contentType.split("/")[1]?.slice(0, 4) ?? "bin";
  const filename = `${crypto.randomUUID()}.${ext}`;
  const relativeKey = `${tenantId}/${input.kind}/${filename}`;
  const absolutePath = resolveSafePath(relativeKey);
  if (!absolutePath) {
    return { ok: false, error: "Caminho de arquivo inválido." };
  }

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.buffer);

  const db = getDb();
  const [row] = await db
    .insert(tenantAssets)
    .values({
      tenantId,
      kind: input.kind,
      fileKey: relativeKey,
      displayName: input.originalName ?? null,
      contentType: input.contentType,
      fileSizeBytes: input.size,
    })
    .returning({ id: tenantAssets.id });
  if (!row) {
    await unlink(absolutePath).catch(() => {});
    return { ok: false, error: "Falha ao registrar arquivo." };
  }
  return { ok: true, id: row.id };
}

export async function getTenantAssetById(
  tenantId: string,
  assetId: string
): Promise<{ fileKey: string; contentType: string | null } | null> {
  const db = getDb();
  const [row] = await db
    .select({ fileKey: tenantAssets.fileKey, contentType: tenantAssets.contentType })
    .from(tenantAssets)
    .where(and(eq(tenantAssets.tenantId, tenantId), eq(tenantAssets.id, assetId)))
    .limit(1);
  return row ? { fileKey: row.fileKey, contentType: row.contentType } : null;
}

export async function deleteTenantAsset(
  tenantId: string,
  assetId: string
): Promise<{ ok: true } | { ok: false; error: "not_found" }> {
  const db = getDb();
  const asset = await getTenantAssetById(tenantId, assetId);
  if (!asset) return { ok: false, error: "not_found" };
  const absolutePath = resolveSafePath(asset.fileKey);
  if (absolutePath) {
    await unlink(absolutePath).catch(() => {});
  }
  await db
    .delete(tenantAssets)
    .where(and(eq(tenantAssets.tenantId, tenantId), eq(tenantAssets.id, assetId)));
  return { ok: true };
}