import "dotenv/config";
import Redis from "ioredis";
import postgres from "postgres";
import { processChatwootRaw } from "../src/workers/processors/chatwoot";
import { processWhatsappCloudRaw } from "../src/workers/processors/whatsapp-cloud";
import { QUEUE_AI_CLASSIFICATION } from "../src/workers/queue/types";
import { classifyDedupRedisKey } from "../src/server/ai/enqueue-classification";
import { listConversationsForTenant } from "../src/server/dashboard/conversations";
import { getConversationDetailForTenant } from "../src/server/dashboard/conversation-detail";

type RowWithId = { id: string };

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value?.trim()) {
    throw new Error(`${key} nao definida.`);
  }
  return value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function findClassificationPayloads(
  redis: Redis,
  conversationId: string
): Promise<string[]> {
  const items = await redis.lrange(QUEUE_AI_CLASSIFICATION, 0, -1);
  return items.filter((item) => {
    try {
      const parsed = JSON.parse(item) as { type?: string; conversationId?: string };
      return (
        parsed.type === "classify_conversation" &&
        parsed.conversationId === conversationId
      );
    } catch {
      return false;
    }
  });
}

async function cleanupClassificationPayloads(
  redis: Redis,
  conversationId: string,
  tenantId?: string
): Promise<void> {
  const payloads = await findClassificationPayloads(redis, conversationId);
  for (const payload of payloads) {
    await redis.lrem(QUEUE_AI_CLASSIFICATION, 0, payload);
  }
  // Limpa também a chave de dedup (janela de 30s). Sem isso, o próximo enqueue
  // dessa conversa dentro de 30s seria suprimido — comportamento correto em
  // produção, mas atrapalha o smoke que valida fluxos sequenciais.
  if (tenantId) {
    await redis.del(classifyDedupRedisKey(tenantId, conversationId));
  }
}

async function ensureTenant(sql: postgres.Sql): Promise<{ id: string; slug: string }> {
  const preferredSlug = process.env.SEED_TENANT_SLUG ?? "tenant-teste";
  const bySlug = await sql<{ id: string; slug: string }[]>`
    select id, slug
    from tenants
    where slug = ${preferredSlug}
    limit 1
  `;
  if (bySlug[0]) return bySlug[0];

  const firstTenant = await sql<{ id: string; slug: string }[]>`
    select id, slug
    from tenants
    order by created_at asc
    limit 1
  `;
  if (firstTenant[0]) return firstTenant[0];

  throw new Error("Nenhum tenant encontrado. Rode npm run db:seed antes.");
}

async function ensureChatwootAccount(
  sql: postgres.Sql,
  tenantId: string,
  runId: string
): Promise<string> {
  const externalId = `smoke-chatwoot-${runId}`;
  const existing = await sql<RowWithId[]>`
    select id
    from chatwoot_accounts
    where tenant_id = ${tenantId}
      and external_id = ${externalId}
    limit 1
  `;
  if (existing[0]) return existing[0].id;

  const inserted = await sql<RowWithId[]>`
    insert into chatwoot_accounts (
      tenant_id,
      external_id,
      base_url,
      api_token_encrypted,
      label
    )
    values (
      ${tenantId},
      ${externalId},
      'https://app.chatwoot.com',
      'smoke-chatwoot-secret',
      ${`Smoke Chatwoot ${runId}`}
    )
    returning id
  `;
  return inserted[0].id;
}

async function ensureWhatsappCloudNumber(
  sql: postgres.Sql,
  tenantId: string,
  runId: string
): Promise<string> {
  const phoneNumberId = `smoke-wa-phone-${runId}`;
  const existing = await sql<RowWithId[]>`
    select id
    from whatsapp_cloud_numbers
    where tenant_id = ${tenantId}
      and phone_number_id = ${phoneNumberId}
    limit 1
  `;
  if (existing[0]) return existing[0].id;

  const inserted = await sql<RowWithId[]>`
    insert into whatsapp_cloud_numbers (
      tenant_id,
      phone_number_id,
      waba_id,
      display_phone,
      webhook_verify_token,
      label
    )
    values (
      ${tenantId},
      ${phoneNumberId},
      ${`smoke-waba-${runId}`},
      '+15550000002',
      ${`smoke-wc-token-${runId}`},
      ${`Smoke WhatsApp Cloud ${runId}`}
    )
    returning id
  `;
  return inserted[0].id;
}

async function insertChatwootRaw(
  sql: postgres.Sql,
  args: {
    tenantId: string;
    chatwootAccountId: string;
    eventType: string;
    externalEventId: string;
    payload: postgres.JSONValue;
  }
): Promise<string> {
  const inserted = await sql<RowWithId[]>`
    insert into chatwoot_webhook_events (
      tenant_id,
      chatwoot_account_id,
      external_event_id,
      event_type,
      payload,
      received_at
    )
    values (
      ${args.tenantId},
      ${args.chatwootAccountId},
      ${args.externalEventId},
      ${args.eventType},
      ${sql.json(args.payload)},
      now()
    )
    returning id
  `;
  return inserted[0].id;
}

async function insertWhatsappRaw(
  sql: postgres.Sql,
  args: {
    tenantId: string;
    whatsappCloudNumberId: string;
    eventType: string;
    externalEventId: string;
    payload: postgres.JSONValue;
  }
): Promise<string> {
  const inserted = await sql<RowWithId[]>`
    insert into whatsapp_cloud_webhook_events (
      tenant_id,
      whatsapp_cloud_number_id,
      external_event_id,
      event_type,
      payload,
      received_at
    )
    values (
      ${args.tenantId},
      ${args.whatsappCloudNumberId},
      ${args.externalEventId},
      ${args.eventType},
      ${sql.json(args.payload)},
      now()
    )
    returning id
  `;
  return inserted[0].id;
}

async function countRows(
  query: PromiseLike<Array<{ count: number }>>
): Promise<number> {
  const rows = await query;
  return rows[0]?.count ?? 0;
}

async function main(): Promise<void> {
  requiredEnv("DATABASE_URL");
  requiredEnv("REDIS_URL");

  const runId = `channels-${Date.now()}`;
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const redis = new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: 2,
    connectTimeout: 5000,
  });

  let chatwootConversationId: string | null = null;
  let whatsappConversationId: string | null = null;
  let tenantIdForCleanup: string | undefined;

  try {
    const tenant = await ensureTenant(sql);
    tenantIdForCleanup = tenant.id;
    const chatwootAccountId = await ensureChatwootAccount(sql, tenant.id, runId);
    const whatsappCloudNumberId = await ensureWhatsappCloudNumber(sql, tenant.id, runId);

    const chatwootConversationExternalId = `cw-conv-${runId}`;
    const chatwootMessageExternalId = `cw-msg-${runId}`;
    const chatwootPrivateMessageId = `cw-private-${runId}`;
    const whatsappWaId = `5511999000${runId.replace(/\D/g, "").slice(-4)}`;
    const whatsappMessageExternalId = `wamid.${runId}`;

    const chatwootConversation = {
      id: chatwootConversationExternalId,
      created_at: "2026-04-24T12:00:00.000Z",
      contact_inbox: {
        contact: {
          name: "Smoke Chatwoot Contact",
          email: `smoke-chatwoot-${runId}@example.com`,
          phone_number: "+55 11 99888-7766",
        },
      },
    };

    const chatwootConversationPayload = {
      event: "conversation_created",
      id: `evt-cw-conv-${runId}`,
      conversation: chatwootConversation,
    };

    const chatwootConversationRawId = await insertChatwootRaw(sql, {
      tenantId: tenant.id,
      chatwootAccountId,
      eventType: "conversation_created",
      externalEventId: `evt-cw-conv-${runId}`,
      payload: chatwootConversationPayload as postgres.JSONValue,
    });

    const chatwootConversationResult = await processChatwootRaw({
      type: "process_chatwoot_raw",
      rawEventId: chatwootConversationRawId,
      tenantId: tenant.id,
      chatwootAccountId,
    });
    assert("ok" in chatwootConversationResult, "Chatwoot conversation_created deve processar com sucesso");

    const chatwootConversations = await sql<RowWithId[]>`
      select id
      from conversations
      where tenant_id = ${tenant.id}
        and chatwoot_account_id = ${chatwootAccountId}
        and external_id = ${chatwootConversationExternalId}
      limit 1
    `;
    assert(chatwootConversations[0], "Chatwoot deve criar conversa");
    chatwootConversationId = chatwootConversations[0].id;

    const chatwootContacts = await countRows(
      sql<{ count: number }[]>`
        select count(*)::int as count
        from contacts
        where tenant_id = ${tenant.id}
          and normalized_email = ${`smoke-chatwoot-${runId}@example.com`}
      `
    );
    assert(chatwootContacts === 1, "Chatwoot deve criar ou resolver contato");

    await cleanupClassificationPayloads(redis, chatwootConversationId, tenant.id);

    const chatwootMessagePayload = {
      event: "message_created",
      id: `evt-cw-msg-${runId}`,
      conversation: chatwootConversation,
      message: {
        id: chatwootMessageExternalId,
        content: "Mensagem inbound Chatwoot smoke",
        message_type: "incoming",
        created_at: "2026-04-24T12:01:00.000Z",
      },
      sender: {
        type: "contact",
      },
    };

    const chatwootMessageRawId = await insertChatwootRaw(sql, {
      tenantId: tenant.id,
      chatwootAccountId,
      eventType: "message_created",
      externalEventId: `evt-cw-msg-${runId}`,
      payload: chatwootMessagePayload as postgres.JSONValue,
    });

    const chatwootMessageResult = await processChatwootRaw({
      type: "process_chatwoot_raw",
      rawEventId: chatwootMessageRawId,
      tenantId: tenant.id,
      chatwootAccountId,
    });
    assert("ok" in chatwootMessageResult, "Chatwoot message_created deve processar com sucesso");

    const chatwootMessageCount = await countRows(
      sql<{ count: number }[]>`
        select count(*)::int as count
        from conversation_messages
        where conversation_id = ${chatwootConversationId}
          and external_id = ${chatwootMessageExternalId}
      `
    );
    assert(chatwootMessageCount === 1, "Chatwoot deve gravar mensagem com dedup por external_id");

    const chatwootClassificationPayloads = await findClassificationPayloads(
      redis,
      chatwootConversationId
    );
    assert(
      chatwootClassificationPayloads.length === 1,
      "Chatwoot deve enfileirar classificacao somente para mensagem nova"
    );

    const chatwootReplayRawId = await insertChatwootRaw(sql, {
      tenantId: tenant.id,
      chatwootAccountId,
      eventType: "message_created",
      externalEventId: `evt-cw-msg-replay-${runId}`,
      payload: chatwootMessagePayload as postgres.JSONValue,
    });

    const chatwootReplayResult = await processChatwootRaw({
      type: "process_chatwoot_raw",
      rawEventId: chatwootReplayRawId,
      tenantId: tenant.id,
      chatwootAccountId,
    });
    assert("ok" in chatwootReplayResult, "Replay Chatwoot deve ser tolerado");

    const chatwootMessageCountAfterReplay = await countRows(
      sql<{ count: number }[]>`
        select count(*)::int as count
        from conversation_messages
        where conversation_id = ${chatwootConversationId}
          and external_id = ${chatwootMessageExternalId}
      `
    );
    assert(
      chatwootMessageCountAfterReplay === 1,
      "Replay Chatwoot nao deve duplicar mensagem"
    );

    const chatwootClassificationAfterReplay = await findClassificationPayloads(
      redis,
      chatwootConversationId
    );
    assert(
      chatwootClassificationAfterReplay.length === 1,
      "Replay Chatwoot nao deve enfileirar classificacao extra"
    );

    const chatwootPrivateRawId = await insertChatwootRaw(sql, {
      tenantId: tenant.id,
      chatwootAccountId,
      eventType: "message_created",
      externalEventId: `evt-cw-private-${runId}`,
      payload: {
        ...chatwootMessagePayload,
        id: `evt-cw-private-${runId}`,
        private: true,
        message: {
          ...chatwootMessagePayload.message,
          id: chatwootPrivateMessageId,
        },
      } as postgres.JSONValue,
    });

    const chatwootPrivateResult = await processChatwootRaw({
      type: "process_chatwoot_raw",
      rawEventId: chatwootPrivateRawId,
      tenantId: tenant.id,
      chatwootAccountId,
    });
    assert("ok" in chatwootPrivateResult, "Evento privado Chatwoot deve ser ignorado sem erro");

    const privateMessageCount = await countRows(
      sql<{ count: number }[]>`
        select count(*)::int as count
        from conversation_messages
        where conversation_id = ${chatwootConversationId}
          and external_id = ${chatwootPrivateMessageId}
      `
    );
    assert(privateMessageCount === 0, "Evento privado Chatwoot nao deve gravar mensagem");

    const chatwootErrorRawId = await insertChatwootRaw(sql, {
      tenantId: tenant.id,
      chatwootAccountId,
      eventType: "message_created",
      externalEventId: `evt-cw-error-${runId}`,
      payload: {
        event: "message_created",
        conversation: chatwootConversation,
        message: {
          content: "payload invalido sem id",
        },
      } as postgres.JSONValue,
    });

    const chatwootErrorResult = await processChatwootRaw({
      type: "process_chatwoot_raw",
      rawEventId: chatwootErrorRawId,
      tenantId: tenant.id,
      chatwootAccountId,
    });
    assert("error" in chatwootErrorResult, "Chatwoot invalido deve registrar erro");

    const chatwootErrorRows = await sql<{ processing_error: string | null; processed_at: string | null }[]>`
      select processing_error, processed_at
      from chatwoot_webhook_events
      where id = ${chatwootErrorRawId}
      limit 1
    `;
    assert(
      !!chatwootErrorRows[0]?.processing_error && !!chatwootErrorRows[0]?.processed_at,
      "Chatwoot invalido deve preencher processing_error e processed_at"
    );

    const whatsappMessagesPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: `entry-${runId}`,
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                contacts: [
                  {
                    wa_id: whatsappWaId,
                    profile: { name: "Smoke WhatsApp Contact" },
                  },
                ],
                messages: [
                  {
                    id: whatsappMessageExternalId,
                    from: whatsappWaId,
                    timestamp: "1713960120",
                    type: "text",
                    text: { body: "Mensagem inbound WhatsApp Cloud smoke" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const whatsappRawId = await insertWhatsappRaw(sql, {
      tenantId: tenant.id,
      whatsappCloudNumberId,
      eventType: "messages",
      externalEventId: `evt-wa-msg-${runId}`,
      payload: whatsappMessagesPayload as postgres.JSONValue,
    });

    const whatsappResult = await processWhatsappCloudRaw({
      type: "process_whatsapp_cloud_raw",
      rawEventId: whatsappRawId,
      tenantId: tenant.id,
      whatsappCloudNumberId,
    });
    assert("ok" in whatsappResult, "WhatsApp Cloud messages deve processar com sucesso");

    const whatsappConversations = await sql<RowWithId[]>`
      select id
      from conversations
      where tenant_id = ${tenant.id}
        and whatsapp_cloud_number_id = ${whatsappCloudNumberId}
        and external_id = ${whatsappWaId}
      limit 1
    `;
    assert(whatsappConversations[0], "WhatsApp Cloud deve criar conversa");
    whatsappConversationId = whatsappConversations[0].id;

    await cleanupClassificationPayloads(redis, whatsappConversationId, tenant.id);

    const whatsappReplayRawId = await insertWhatsappRaw(sql, {
      tenantId: tenant.id,
      whatsappCloudNumberId,
      eventType: "messages",
      externalEventId: `evt-wa-msg-replay-${runId}`,
      payload: whatsappMessagesPayload as postgres.JSONValue,
    });

    const whatsappReplayResult = await processWhatsappCloudRaw({
      type: "process_whatsapp_cloud_raw",
      rawEventId: whatsappReplayRawId,
      tenantId: tenant.id,
      whatsappCloudNumberId,
    });
    assert("ok" in whatsappReplayResult, "Replay WhatsApp Cloud deve ser tolerado");

    const whatsappMessageCount = await countRows(
      sql<{ count: number }[]>`
        select count(*)::int as count
        from conversation_messages
        where conversation_id = ${whatsappConversationId}
          and external_id = ${whatsappMessageExternalId}
      `
    );
    assert(
      whatsappMessageCount === 1,
      "WhatsApp Cloud deve manter dedup de mensagem por external_id"
    );

    const whatsappContactCount = await countRows(
      sql<{ count: number }[]>`
        select count(*)::int as count
        from contacts
        where tenant_id = ${tenant.id}
          and normalized_phone = ${whatsappWaId}
      `
    );
    assert(whatsappContactCount === 1, "WhatsApp Cloud deve criar ou resolver contato por wa_id");

    const whatsappClassificationPayloads = await findClassificationPayloads(
      redis,
      whatsappConversationId
    );
    assert(
      whatsappClassificationPayloads.length === 0,
      "Replay WhatsApp Cloud nao deve enfileirar classificacao extra"
    );

    const whatsappFreshMessageId = `wamid.${runId}.fresh`;
    const whatsappFreshPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: `entry-fresh-${runId}`,
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                contacts: [
                  {
                    wa_id: whatsappWaId,
                    profile: { name: "Smoke WhatsApp Contact" },
                  },
                ],
                messages: [
                  {
                    id: whatsappFreshMessageId,
                    from: whatsappWaId,
                    timestamp: "1713960180",
                    type: "text",
                    text: { body: "Mensagem nova WhatsApp Cloud smoke" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const whatsappFreshRawId = await insertWhatsappRaw(sql, {
      tenantId: tenant.id,
      whatsappCloudNumberId,
      eventType: "messages",
      externalEventId: `evt-wa-msg-fresh-${runId}`,
      payload: whatsappFreshPayload as postgres.JSONValue,
    });

    const whatsappFreshResult = await processWhatsappCloudRaw({
      type: "process_whatsapp_cloud_raw",
      rawEventId: whatsappFreshRawId,
      tenantId: tenant.id,
      whatsappCloudNumberId,
    });
    assert("ok" in whatsappFreshResult, "WhatsApp Cloud mensagem nova deve processar com sucesso");

    const whatsappClassificationAfterFresh = await findClassificationPayloads(
      redis,
      whatsappConversationId
    );
    assert(
      whatsappClassificationAfterFresh.length === 1,
      "WhatsApp Cloud deve enfileirar classificacao apenas para mensagem nova"
    );

    const whatsappStatusRawId = await insertWhatsappRaw(sql, {
      tenantId: tenant.id,
      whatsappCloudNumberId,
      eventType: "statuses",
      externalEventId: `evt-wa-status-${runId}`,
      payload: {
        object: "whatsapp_business_account",
        entry: [
          {
            id: `entry-status-${runId}`,
            changes: [
              {
                field: "messages",
                value: {
                  statuses: [
                    {
                      id: whatsappMessageExternalId,
                      status: "delivered",
                      timestamp: "1713960200",
                    },
                  ],
                },
              },
            ],
          },
        ],
      } as postgres.JSONValue,
    });

    const whatsappStatusResult = await processWhatsappCloudRaw({
      type: "process_whatsapp_cloud_raw",
      rawEventId: whatsappStatusRawId,
      tenantId: tenant.id,
      whatsappCloudNumberId,
    });
    assert("ok" in whatsappStatusResult, "WhatsApp Cloud statuses deve ser acknowledged no MVP");

    const whatsappStatusRows = await sql<{ processed_at: string | null; processing_error: string | null }[]>`
      select processed_at, processing_error
      from whatsapp_cloud_webhook_events
      where id = ${whatsappStatusRawId}
      limit 1
    `;
    assert(
      !!whatsappStatusRows[0]?.processed_at && !whatsappStatusRows[0]?.processing_error,
      "WhatsApp Cloud statuses deve marcar processed_at sem erro"
    );

    const whatsappErrorRawId = await insertWhatsappRaw(sql, {
      tenantId: tenant.id,
      whatsappCloudNumberId,
      eventType: "messages",
      externalEventId: `evt-wa-error-${runId}`,
      payload: {
        object: "whatsapp_business_account",
        entry: [
          {
            id: `entry-error-${runId}`,
            changes: [
              {
                field: "messages",
                value: {
                  messages: [
                    {
                      timestamp: "1713960250",
                      type: "text",
                      text: { body: "payload invalido sem from/to e sem id" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      } as postgres.JSONValue,
    });

    const whatsappErrorResult = await processWhatsappCloudRaw({
      type: "process_whatsapp_cloud_raw",
      rawEventId: whatsappErrorRawId,
      tenantId: tenant.id,
      whatsappCloudNumberId,
    });
    assert("error" in whatsappErrorResult, "WhatsApp Cloud invalido deve registrar erro");

    const whatsappErrorRows = await sql<{ processing_error: string | null; processed_at: string | null }[]>`
      select processing_error, processed_at
      from whatsapp_cloud_webhook_events
      where id = ${whatsappErrorRawId}
      limit 1
    `;
    assert(
      !!whatsappErrorRows[0]?.processing_error && !!whatsappErrorRows[0]?.processed_at,
      "WhatsApp Cloud invalido deve preencher processing_error e processed_at"
    );

    const listRows = await listConversationsForTenant(tenant.id, { limit: 300 });
    const chatwootListRow = listRows.find((row) => row.id === chatwootConversationId);
    const whatsappListRow = listRows.find((row) => row.id === whatsappConversationId);
    assert(
      !!chatwootListRow?.instanceDisplay?.includes("Chatwoot"),
      "Dashboard deve expor label Chatwoot na listagem"
    );
    assert(
      !!whatsappListRow?.instanceDisplay?.includes("WhatsApp"),
      "Dashboard deve expor label WhatsApp na listagem"
    );

    const chatwootDetail = await getConversationDetailForTenant(
      tenant.id,
      chatwootConversationId
    );
    const whatsappDetail = await getConversationDetailForTenant(
      tenant.id,
      whatsappConversationId
    );
    assert(
      !!chatwootDetail?.instanceDisplay.includes("Chatwoot"),
      "Dashboard deve expor label Chatwoot no detalhe"
    );
    assert(
      !!whatsappDetail?.instanceDisplay.includes("WhatsApp"),
      "Dashboard deve expor label WhatsApp no detalhe"
    );

    console.log(
      JSON.stringify(
        {
          tenant: tenant.slug,
          runId,
          chatwoot: {
            conversationCreated: true,
            messageDedup: true,
            privateIgnored: true,
            classificationEnqueuedOnce: true,
            processingErrorHandled: true,
          },
          whatsappCloud: {
            conversationCreated: true,
            messageDedup: true,
            statusesAcknowledged: true,
            classificationEnqueuedOnce: true,
            processingErrorHandled: true,
          },
          dashboard: {
            labelsValidated: true,
          },
        },
        null,
        2
      )
    );
  } finally {
    if (chatwootConversationId) {
      await cleanupClassificationPayloads(redis, chatwootConversationId, tenantIdForCleanup).catch(() => {});
    }
    if (whatsappConversationId) {
      await cleanupClassificationPayloads(redis, whatsappConversationId, tenantIdForCleanup).catch(() => {});
    }

    const runPattern = `%${runId}%`;
    await sql`delete from chatwoot_webhook_events where external_event_id like ${runPattern}`;
    await sql`delete from whatsapp_cloud_webhook_events where external_event_id like ${runPattern}`;
    await sql`delete from conversation_messages where external_id like ${runPattern} or external_id like ${`wamid.${runId}%`}`;
    await sql`delete from conversations where external_id in (${`cw-conv-${runId}`}, ${`5511999000${runId.replace(/\D/g, "").slice(-4)}`})`;
    await sql`
      delete from contacts
      where normalized_email = ${`smoke-chatwoot-${runId}@example.com`}
         or normalized_phone = ${`5511999000${runId.replace(/\D/g, "").slice(-4)}`}
    `;
    await sql`delete from chatwoot_accounts where external_id = ${`smoke-chatwoot-${runId}`}`;
    await sql`delete from whatsapp_cloud_numbers where phone_number_id = ${`smoke-wa-phone-${runId}`}`;

    await redis.quit().catch(() => {});
    await sql.end({ timeout: 5 });
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error("[smoke:channels] falhou:", err);
  process.exit(1);
});
