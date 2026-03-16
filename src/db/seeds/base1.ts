/**
 * Seed Base 1: roles, permissions, role_permissions, tenant de teste, super_admin, membership.
 * Opcional: um bot Typebot e/ou uma instância Evolution no tenant do seed (via SEED_TYPEBOT_* / SEED_EVOLUTION_*).
 * Idempotente: seguro reexecutar; não duplica dados (onConflictDoNothing / select antes de inserir).
 */
import { and, eq, inArray } from "drizzle-orm";
import argon2 from "argon2";
import { getDb } from "@/server/db";
import {
  roles,
  permissions,
  rolePermissions,
  tenants,
  users,
  memberships,
  typebotBots,
  evolutionInstances,
  integrations,
} from "@/db/schema";
import { hashWebhookSecret } from "@/server/integrations/webhook-secret";
import { encryptSecret } from "@/server/security/secret-crypto";

const ROLE_SLUGS = [
  { slug: "super_admin", name: "Super Admin", description: "Acesso total e admin central" },
  { slug: "admin_tenant", name: "Admin do Tenant", description: "Administrador do tenant" },
  { slug: "operator", name: "Operador", description: "Uso operacional do funil" },
  { slug: "viewer", name: "Visualizador", description: "Somente leitura" },
] as const;

const PERMISSION_SLUGS = [
  { slug: "admin:access", name: "Acesso admin central", resource: "admin", action: "access" },
  { slug: "dashboard:read", name: "Ver dashboard", resource: "dashboard", action: "read" },
  { slug: "tenant:switch", name: "Trocar tenant", resource: "tenant", action: "switch" },
  { slug: "leads:read", name: "Ver leads", resource: "leads", action: "read" },
  { slug: "leads:write", name: "Editar leads", resource: "leads", action: "write" },
  { slug: "funnels:read", name: "Ver funis", resource: "funnels", action: "read" },
  { slug: "funnels:write", name: "Editar funis", resource: "funnels", action: "write" },
] as const;

/** Permissões atribuídas ao super_admin (todas na seed mínima) */
const SUPER_ADMIN_PERMISSIONS = PERMISSION_SLUGS.map((p) => p.slug);

function getSeedEnv() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    throw new Error(
      "SEED_ADMIN_PASSWORD é obrigatória. Defina em .env.local (ex.: SEED_ADMIN_PASSWORD=suasenha)."
    );
  }
  return {
    adminEmail: email,
    adminPassword: password,
    adminName: process.env.SEED_ADMIN_NAME ?? "Super Admin",
    tenantName: process.env.SEED_TENANT_NAME ?? "Tenant de Teste",
    tenantSlug: process.env.SEED_TENANT_SLUG ?? "tenant-teste",
  };
}

export async function run(): Promise<void> {
  const db = getDb();
  const { adminEmail, adminPassword, adminName, tenantName, tenantSlug } = getSeedEnv();

  // 1. Roles (idempotente)
  await db
    .insert(roles)
    .values(
      ROLE_SLUGS.map((r) => ({
        slug: r.slug,
        name: r.name,
        description: r.description,
      }))
    )
    .onConflictDoNothing({ target: roles.slug });

  const roleRows = await db
    .select({ id: roles.id, slug: roles.slug })
    .from(roles)
    .where(inArray(roles.slug, ROLE_SLUGS.map((r) => r.slug)));
  const roleById = Object.fromEntries(roleRows.map((r) => [r.slug, r.id]));
  const superAdminRoleId = roleById.super_admin;
  if (!superAdminRoleId) throw new Error("Role super_admin não encontrada após insert.");

  // 2. Permissions (idempotente)
  await db
    .insert(permissions)
    .values(
      PERMISSION_SLUGS.map((p) => ({
        slug: p.slug,
        name: p.name,
        resource: p.resource,
        action: p.action,
      }))
    )
    .onConflictDoNothing({ target: permissions.slug });

  const permissionRows = await db
    .select({ id: permissions.id, slug: permissions.slug })
    .from(permissions)
    .where(inArray(permissions.slug, SUPER_ADMIN_PERMISSIONS));
  const permIds = permissionRows.map((p) => p.id);

  // 3. role_permissions: super_admin -> todas as permissões (idempotente)
  if (permIds.length > 0) {
    await db
      .insert(rolePermissions)
      .values(
        permIds.map((permissionId) => ({
          roleId: superAdminRoleId,
          permissionId,
        }))
      )
      .onConflictDoNothing({ target: [rolePermissions.roleId, rolePermissions.permissionId] });
  }

  // 4. Tenant (idempotente)
  await db
    .insert(tenants)
    .values({
      name: tenantName,
      slug: tenantSlug,
      isActive: true,
    })
    .onConflictDoNothing({ target: tenants.slug });

  const [tenantRow] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug));
  if (!tenantRow) throw new Error("Tenant não encontrado após insert.");
  const tenantId = tenantRow.id;

  // 5. User super_admin (idempotente; senha só aplicada em insert novo)
  const passwordHash = await argon2.hash(adminPassword, { type: argon2.argon2id });
  await db
    .insert(users)
    .values({
      email: adminEmail,
      passwordHash,
      name: adminName,
      isActive: true,
    })
    .onConflictDoNothing({ target: users.email });

  const [userRow] = await db.select({ id: users.id }).from(users).where(eq(users.email, adminEmail));
  if (!userRow) throw new Error("Usuário não encontrado após insert.");
  const userId = userRow.id;

  // 6. Membership: super_admin no tenant de teste (idempotente)
  await db
    .insert(memberships)
    .values({
      userId,
      tenantId,
      roleId: superAdminRoleId,
      invitedAt: new Date(),
    })
    .onConflictDoNothing({ target: [memberships.userId, memberships.tenantId] });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://sua-app.com";

  // 7. Opcional: bot Typebot no tenant do seed (idempotente por tenant_id + external_id)
  const typebotExternalId = process.env.SEED_TYPEBOT_EXTERNAL_ID?.trim();
  if (typebotExternalId) {
    const [existingBot] = await db
      .select({ id: typebotBots.id })
      .from(typebotBots)
      .where(
        and(
          eq(typebotBots.tenantId, tenantId),
          eq(typebotBots.externalId, typebotExternalId)
        )
      )
      .limit(1);
    if (!existingBot) {
      const webhookSecret = process.env.SEED_TYPEBOT_WEBHOOK_SECRET?.trim();
      const typebotApiToken = process.env.SEED_TYPEBOT_API_TOKEN?.trim();
      const typebotMetricsApiBaseUrl =
        process.env.SEED_TYPEBOT_METRICS_API_BASE_URL?.trim() ||
        process.env.TYPEBOT_API_BASE_URL?.trim() ||
        null;
      const [inserted] = await db
        .insert(typebotBots)
        .values({
          tenantId,
          externalId: typebotExternalId,
          name: process.env.SEED_TYPEBOT_NAME?.trim() || `Typebot ${typebotExternalId}`,
          webhookSecretHash: webhookSecret
            ? hashWebhookSecret(webhookSecret)
            : null,
          webhookSecretEncrypted: webhookSecret
            ? encryptSecret(webhookSecret)
            : null,
          apiTokenEncrypted: typebotApiToken ? encryptSecret(typebotApiToken) : null,
          metricsApiBaseUrl: typebotMetricsApiBaseUrl
            ? typebotMetricsApiBaseUrl.replace(/\/$/, "")
            : null,
        })
        .returning({ id: typebotBots.id });
      if (inserted) {
        await db
          .insert(integrations)
          .values({
            tenantId,
            provider: "typebot",
            name: process.env.SEED_TYPEBOT_NAME?.trim() || `Typebot ${typebotExternalId}`,
            providerResourceId: inserted.id,
            isActive: true,
          })
          .onConflictDoNothing({
            target: [
              integrations.tenantId,
              integrations.provider,
              integrations.providerResourceId,
            ],
          });
        const base = appUrl.replace(/\/$/, "");
        console.log("  - Typebot bot criado. Webhook URL:", `${base}/api/webhooks/typebot/${inserted.id}`);
      }
    }
  }

  // 8. Opcional: instância Evolution no tenant do seed (idempotente por tenant_id + external_id)
  const evolutionExternalId = process.env.SEED_EVOLUTION_EXTERNAL_ID?.trim();
  const evolutionBaseUrl = process.env.SEED_EVOLUTION_BASE_URL?.trim();
  const evolutionApiKey = process.env.SEED_EVOLUTION_API_KEY?.trim();
  if (evolutionExternalId && evolutionBaseUrl) {
    const [existingInstance] = await db
      .select({ id: evolutionInstances.id })
      .from(evolutionInstances)
      .where(
        and(
          eq(evolutionInstances.tenantId, tenantId),
          eq(evolutionInstances.externalId, evolutionExternalId)
        )
      )
      .limit(1);
    if (!existingInstance) {
      const [inserted] = await db
        .insert(evolutionInstances)
        .values({
          tenantId,
          externalId: evolutionExternalId,
          baseUrl: evolutionBaseUrl,
          apiKeyEncrypted: evolutionApiKey ? encryptSecret(evolutionApiKey) : null,
          instanceName:
            process.env.SEED_EVOLUTION_INSTANCE_NAME?.trim() ||
            `Evolution ${evolutionExternalId}`,
        })
        .returning({ id: evolutionInstances.id });
      if (inserted) {
        await db
          .insert(integrations)
          .values({
            tenantId,
            provider: "evolution",
            name:
              process.env.SEED_EVOLUTION_INSTANCE_NAME?.trim() ||
              `Evolution ${evolutionExternalId}`,
            providerResourceId: inserted.id,
            isActive: true,
          })
          .onConflictDoNothing({
            target: [
              integrations.tenantId,
              integrations.provider,
              integrations.providerResourceId,
            ],
          });
        const base = appUrl.replace(/\/$/, "");
        console.log("  - Evolution instance criada. Webhook URL:", `${base}/api/webhooks/evolution/${inserted.id}`);
      }
    }
  }

  console.log("Seed Base 1 concluído:");
  console.log("  - Roles:", ROLE_SLUGS.length);
  console.log("  - Permissions:", PERMISSION_SLUGS.length);
  console.log("  - Tenant:", tenantSlug);
  console.log("  - User:", adminEmail);
  console.log("  - Membership: super_admin no tenant de teste.");
}
