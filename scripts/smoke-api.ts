import { readFileSync } from "node:fs";
import path from "node:path";

function readRequired(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function assertIncludes(content: string, needle: string, message: string): void {
  if (!content.includes(needle)) {
    throw new Error(message);
  }
}

function main(): void {
  const envConfig = readRequired("src/config/env.ts");
  assertIncludes(
    envConfig,
    "metaAppSecret",
    "config de ambiente deve expor META_APP_SECRET para WhatsApp Cloud"
  );

  const tenantSwitch = readRequired("src/app/api/context/tenant/route.ts");
  assertIncludes(
    tenantSwitch,
    "requireAuth",
    "tenant switch deve exigir autenticacao"
  );
  assertIncludes(
    tenantSwitch,
    "switchTenant(",
    "tenant switch deve usar validacao server-side de membership"
  );

  const dashboardChat = readRequired("src/app/api/dashboard/vysen/chat/route.ts");
  assertIncludes(
    dashboardChat,
    "requireDashboardApiAuth",
    "API de dashboard deve usar guard de dashboard auth"
  );

  const adminChat = readRequired("src/app/api/admin/vysen/chat/route.ts");
  assertIncludes(
    adminChat,
    "requireAdmin",
    "API admin deve exigir requireAdmin"
  );

  const webhookFiles = [
    "src/app/api/webhooks/typebot/[botId]/route.ts",
    "src/app/api/webhooks/evolution/[instanceId]/route.ts",
    "src/app/api/webhooks/uazapi/[instanceId]/route.ts",
  ];

  for (const file of webhookFiles) {
    const content = readRequired(file);
    assertIncludes(content, "checkRateLimit", `${file} deve aplicar rate limit`);
    assertIncludes(content, "checkWebhookReplay", `${file} deve aplicar anti-replay`);
    assertIncludes(
      content,
      "withWebhookRlsTransaction",
      `${file} deve isolar RLS do webhook (bypass + lock tenant)`
    );
  }

  const chatwootRoute = readRequired("src/app/api/webhooks/chatwoot/[accountId]/route.ts");
  assertIncludes(chatwootRoute, "checkRateLimit", "webhook Chatwoot deve aplicar rate limit");
  assertIncludes(chatwootRoute, "checkWebhookReplay", "webhook Chatwoot deve aplicar anti-replay");
  assertIncludes(
    chatwootRoute,
    "withWebhookRlsTransaction",
    "webhook Chatwoot deve isolar RLS (bypass + lock tenant)"
  );
  assertIncludes(
    chatwootRoute,
    "validateWebhookRequest",
    "webhook Chatwoot deve validar autenticidade antes de ingerir"
  );
  assertIncludes(
    chatwootRoute,
    "ingestChatwootWebhook",
    "webhook Chatwoot deve persistir raw event e enfileirar processamento"
  );

  const chatwootValidate = readRequired("src/server/integrations/chatwoot/validate.ts");
  assertIncludes(
    chatwootValidate,
    "x-chatwoot-signature",
    "validador Chatwoot deve usar o header x-chatwoot-signature"
  );
  assertIncludes(
    chatwootValidate,
    "createHmac",
    "validador Chatwoot deve verificar HMAC-SHA256"
  );

  const whatsappRoute = readRequired(
    "src/app/api/webhooks/whatsapp-cloud/[numberId]/route.ts"
  );
  assertIncludes(
    whatsappRoute,
    "export async function GET",
    "webhook WhatsApp Cloud deve expor hub verification via GET"
  );
  assertIncludes(
    whatsappRoute,
    "verifyWhatsappCloudHub",
    "webhook WhatsApp Cloud deve validar hub challenge"
  );
  assertIncludes(
    whatsappRoute,
    "env.metaAppSecret",
    "webhook WhatsApp Cloud deve ler META_APP_SECRET do env"
  );
  assertIncludes(
    whatsappRoute,
    "checkWebhookReplay",
    "webhook WhatsApp Cloud deve aplicar anti-replay"
  );
  assertIncludes(
    whatsappRoute,
    "ingestWhatsappCloudWebhook",
    "webhook WhatsApp Cloud deve persistir raw event e enfileirar processamento"
  );

  const whatsappValidate = readRequired("src/server/integrations/whatsapp-cloud/validate.ts");
  assertIncludes(
    whatsappValidate,
    "x-hub-signature-256",
    "validador WhatsApp Cloud deve usar o header x-hub-signature-256"
  );
  assertIncludes(
    whatsappValidate,
    "verifyWhatsappCloudHub",
    "validador WhatsApp Cloud deve expor verificacao de hub"
  );

  const chatwootIngest = readRequired("src/server/integrations/chatwoot/ingest.ts");
  assertIncludes(
    chatwootIngest,
    "chatwoot_webhook_events_dedup_unique",
    "ingest Chatwoot deve tratar dedup de raw event"
  );

  const whatsappIngest = readRequired("src/server/integrations/whatsapp-cloud/ingest.ts");
  assertIncludes(
    whatsappIngest,
    "wc_webhook_events_dedup_unique",
    "ingest WhatsApp Cloud deve tratar dedup de raw event"
  );

  // /api/health é o endpoint público minimal: só verifica DB. Worker stale
  // não deve marcar webapp como unhealthy e drogar o tráfego HTTP.
  const health = readRequired("src/app/api/health/route.ts");
  assertIncludes(
    health,
    "select 1",
    "healthcheck público deve checar DB com select 1"
  );
  // Detalhes (heartbeat do worker, Redis, etc.) ficam em /api/health/details
  // atrás de HEALTH_DETAILS_TOKEN.
  const healthDetails = readRequired("src/app/api/health/details/route.ts");
  assertIncludes(
    healthDetails,
    "HEARTBEAT_KEY",
    "health details deve considerar heartbeat do worker"
  );
  assertIncludes(
    healthDetails,
    "HEALTH_DETAILS_TOKEN",
    "health details deve exigir HEALTH_DETAILS_TOKEN"
  );

  console.log("[smoke:api] ok");
}

main();
