/**
 * GET /api/dashboard/tenant-assets — lista arquivos (query: kind opcional).
 * POST /api/dashboard/tenant-assets — upload (multipart: file, kind, displayName?).
 */
import { NextRequest, NextResponse } from "next/server";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import {
  listTenantAssets,
  createTenantAsset,
} from "@/server/dashboard";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind") ?? undefined;

  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;
      const list = await listTenantAssets(tenantId, { kind });
      const serialized = list.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      }));
      return NextResponse.json(serialized);
    }, PERMISSION_SLUGS.DASHBOARD_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}

// Espelha limites da camada server (createTenantAsset). Validados na rota antes
// de buferizar para falhar cedo em uploads maliciosos.
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
]);

export async function POST(request: NextRequest) {
  // Reject early com base no Content-Length (multipart tem overhead, margem 64KB).
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_FILE_SIZE_BYTES + 64 * 1024) {
    return NextResponse.json(
      { error: `Arquivo muito grande. Máximo ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.` },
      { status: 413 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Corpo inválido. Envie multipart com campo 'file' e 'kind'." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Campo 'file' é obrigatório." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `Arquivo muito grande. Máximo ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.` },
      { status: 413 }
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Tipo de arquivo não permitido (use imagem ou PDF)." },
      { status: 415 }
    );
  }

  const kind = formData.get("kind");
  const kindStr = typeof kind === "string" ? kind.trim() : "";
  if (!["logo", "photo", "document"].includes(kindStr)) {
    return NextResponse.json(
      { error: "Campo 'kind' deve ser: logo, photo ou document." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const displayName = typeof formData.get("displayName") === "string"
    ? formData.get("displayName") as string
    : file.name;

  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;
      const result = await createTenantAsset(tenantId, {
        kind: kindStr,
        buffer,
        contentType: file.type || "application/octet-stream",
        originalName: displayName,
        size: file.size,
      });

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true, id: result.id });
    }, PERMISSION_SLUGS.LEADS_WRITE);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
