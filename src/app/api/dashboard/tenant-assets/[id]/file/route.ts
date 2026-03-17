/**
 * GET /api/dashboard/tenant-assets/[id]/file — serve o arquivo (stream).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { getTenantAssetById } from "@/server/dashboard";
import { readFile } from "fs/promises";
import path from "path";

const UPLOAD_DIR = "uploads";

function getAbsolutePath(relativeKey: string): string {
  return path.join(process.cwd(), UPLOAD_DIR, relativeKey);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireAuth(request);
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json(
      { error: "Não autenticado" },
      { status: e.status ?? 401 }
    );
  }

  const tenantId = session.session.currentTenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant não selecionado" },
      { status: 400 }
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: "ID é obrigatório" },
      { status: 400 }
    );
  }

  const asset = await getTenantAssetById(tenantId, id);
  if (!asset) {
    return NextResponse.json(
      { error: "Arquivo não encontrado" },
      { status: 404 }
    );
  }

  const absolutePath = getAbsolutePath(asset.fileKey);
  let buffer: Buffer;
  try {
    buffer = await readFile(absolutePath);
  } catch {
    return NextResponse.json(
      { error: "Arquivo não encontrado no disco" },
      { status: 404 }
    );
  }

  // NextResponse espera BodyInit (ArrayBuffer/Uint8Array/etc). Buffer funciona em runtime,
  // mas o typecheck do Next.js é mais estrito.
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": asset.contentType ?? "application/octet-stream",
      "Content-Disposition": "inline",
    },
  });
}
