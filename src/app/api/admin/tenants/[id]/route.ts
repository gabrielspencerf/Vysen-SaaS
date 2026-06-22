/**
 * GET /api/admin/tenants/[id] — obter tenant (super_admin).
 * PATCH /api/admin/tenants/[id] — atualizar tenant (super_admin).
 */
import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/admin/require-admin";
import {
  getTenantById,
  updateTenant,
  decryptTenantSettingsForResponse,
} from "@/server/admin/tenants";
import { adminApiAuthErrorResponse } from "@/server/admin/api-route-errors";
import { apiError, apiOk } from "@/server/http/api-contract";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);
  } catch (err) {
    return adminApiAuthErrorResponse(err);
  }

  const { id } = await params;
  if (!id) {
    return apiError("resource_required", "ID do tenant é obrigatório", {
      status: 400,
    });
  }

  const tenant = await getTenantById(id);
  if (!tenant) {
    return apiError("tenant_not_found", "Tenant não encontrado", { status: 404 });
  }
  return apiOk({
    ...tenant,
    settings: decryptTenantSettingsForResponse(tenant.settings),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);
  } catch (err) {
    return adminApiAuthErrorResponse(err);
  }

  const { id } = await params;
  if (!id) {
    return apiError("resource_required", "ID do tenant é obrigatório", {
      status: 400,
    });
  }

  let body: {
    name?: string;
    slug?: string;
    is_active?: boolean;
    settings?: Record<string, unknown> | null;
  };
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_body", "Corpo inválido", { status: 400 });
  }

  const result = await updateTenant(id, {
    name: body.name,
    slug: body.slug,
    isActive: body.is_active,
    settings: body.settings,
  });

  if ("error" in result) {
    if (result.error === "Tenant não encontrado") {
      return apiError("tenant_not_found", result.error, { status: 404 });
    }
    const isValidation =
      result.error.includes("obrigatório") || result.error.includes("longo");
    return apiError(
      isValidation ? "invalid_payload" : "duplicate_resource",
      result.error,
      { status: isValidation ? 400 : 409 }
    );
  }
  return apiOk({ ok: true });
}
