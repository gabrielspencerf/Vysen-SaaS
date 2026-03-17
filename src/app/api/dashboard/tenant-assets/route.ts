/**
 * GET /api/dashboard/tenant-assets — lista arquivos (query: kind opcional).
 * POST /api/dashboard/tenant-assets — upload (multipart: file, kind, displayName?).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import {
  listTenantAssets,
  createTenantAsset,
} from "@/server/dashboard";

export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind") ?? undefined;
  const list = await listTenantAssets(tenantId, { kind });
  const serialized = list.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
  }));
  return NextResponse.json(serialized);
}

export async function POST(request: NextRequest) {
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
    return NextResponse.json(
      { error: "Campo 'file' é obrigatório." },
      { status: 400 }
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

  const result = await createTenantAsset(tenantId, {
    kind: kindStr,
    buffer,
    contentType: file.type || "application/octet-stream",
    originalName: displayName,
    size: file.size,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true, id: result.id });
}
