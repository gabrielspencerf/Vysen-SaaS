/**
 * GET /api/dashboard/tenant-assets/[id]/file — serve o arquivo (stream).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import { getTenantAssetById } from "@/server/dashboard";
import { readFile } from "fs/promises";
import path from "path";

const UPLOAD_DIR = "uploads";

function resolveSafeAssetPath(relativeKey: string): string | null {
  // Bloqueia qualquer fileKey que escape do diretório de uploads via "..", caminhos
  // absolutos, ou separadores específicos da plataforma. path.resolve normaliza
  // segmentos; startsWith garante que o arquivo final fica dentro do uploadDir.
  const uploadDir = path.resolve(process.cwd(), UPLOAD_DIR);
  const resolved = path.resolve(uploadDir, relativeKey);
  if (resolved !== uploadDir && !resolved.startsWith(uploadDir + path.sep)) {
    return null;
  }
  return resolved;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireDashboardApiAuth(request, PERMISSION_SLUGS.DASHBOARD_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }

  const tenantId = session.session.currentTenantId!;

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

  const absolutePath = resolveSafeAssetPath(asset.fileKey);
  if (!absolutePath) {
    return NextResponse.json(
      { error: "Arquivo inválido" },
      { status: 400 }
    );
  }
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
