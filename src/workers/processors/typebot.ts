/**
 * Processador: raw event Typebot → lead + lead_event (+ UTM quando aplicável).
 * Idempotente: lead por (tenant_id, source_provider, source_external_id); lead_event dedup por (lead_id, payload._rawEventId).
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  typebotWebhookEvents,
  leads,
  leadEvents,
  funnelSteps,
  utmAttributions,
  integrations,
} from "@/db/schema";
import {
  resolveStepFromTypebotPayload,
  shouldAdvanceLeadStep,
} from "@/server/funnel/resolve-step";
import { notifyTenantUsers } from "@/server/notifications/internal";
import { ensureFollowupTaskForLead } from "@/server/followup/engine";
import { enqueueDueFollowupsForTenant } from "@/server/followup/enqueue-due-followups";
import type { JobProcessTypebotRaw } from "../queue/types";

const SOURCE_PROVIDER = "typebot";
const EVENT_TYPE = "typebot_webhook";
const LEAD_STATUS = "new";

function stringOrNull(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function normalizeEmail(email: string | null): string | null {
  if (!email) return null;
  return email.toLowerCase().trim();
}

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
}

function getFromPayload(
  payload: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const v = payload[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const vars = payload.variables as Record<string, unknown> | undefined;
  if (vars && typeof vars === "object") {
    for (const key of keys) {
      const v = vars[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return null;
}

function getUtmFromPayload(
  payload: Record<string, unknown>
): {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
} {
  const get = (k: string) => stringOrNull(payload[k]) ?? stringOrNull((payload.variables as Record<string, unknown>)?.[k]);
  return {
    utmSource: get("utm_source") ?? get("utmSource"),
    utmMedium: get("utm_medium") ?? get("utmMedium"),
    utmCampaign: get("utm_campaign") ?? get("utmCampaign"),
    utmTerm: get("utm_term") ?? get("utmTerm"),
    utmContent: get("utm_content") ?? get("utmContent"),
  };
}

export async function processTypebotRaw(
  job: JobProcessTypebotRaw
): Promise<{ ok: true } | { error: string }> {
  const db = getDb();
  const { rawEventId } = job;

  try {
    return await processTypebotRawInner(db, job);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(typebotWebhookEvents)
      .set({
        processingError: msg.slice(0, 1024),
        processedAt: new Date(),
      })
      .where(eq(typebotWebhookEvents.id, rawEventId));
    return { error: msg };
  }
}

async function processTypebotRawInner(
  db: ReturnType<typeof getDb>,
  job: JobProcessTypebotRaw
): Promise<{ ok: true } | { error: string }> {
  const { rawEventId, tenantId, typebotBotId } = job;

  const [raw] = await db
    .select()
    .from(typebotWebhookEvents)
    .where(eq(typebotWebhookEvents.id, rawEventId))
    .limit(1);

  if (!raw) {
    return { error: `Raw event not found: ${rawEventId}` };
  }
  if (raw.processedAt) {
    return { ok: true };
  }

  const payload = raw.payload as Record<string, unknown>;
  const receivedAt = raw.receivedAt;

  const sourceExternalId =
    stringOrNull(payload.resultId) ??
    stringOrNull(payload.submissionId) ??
    stringOrNull(payload.result_id) ??
    stringOrNull(payload.submission_id) ??
    rawEventId;

  const [integrationRow] = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(
      and(
        eq(integrations.tenantId, tenantId),
        eq(integrations.provider, SOURCE_PROVIDER),
        eq(integrations.providerResourceId, typebotBotId)
      )
    )
    .limit(1);
  const sourceIntegrationId = integrationRow?.id ?? null;

  const email = getFromPayload(payload, "email", "Email");
  const name = getFromPayload(payload, "name", "Name");
  const phone = getFromPayload(payload, "phone", "Phone");
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  const resolvedStep = await resolveStepFromTypebotPayload(db, tenantId, payload);

  let leadId: string;
  let leadFunnelId: string | null = null;
  const [existingLead] = await db
    .select({
      id: leads.id,
      firstSeenAt: leads.firstSeenAt,
      funnelId: leads.funnelId,
      currentFunnelStepId: leads.currentFunnelStepId,
      currentStepSortOrder: funnelSteps.sortOrder,
    })
    .from(leads)
    .leftJoin(funnelSteps, eq(leads.currentFunnelStepId, funnelSteps.id))
    .where(
      and(
        eq(leads.tenantId, tenantId),
        eq(leads.sourceProvider, SOURCE_PROVIDER),
        eq(leads.sourceExternalId, sourceExternalId)
      )
    )
    .limit(1);

  if (existingLead) {
    leadId = existingLead.id;
    leadFunnelId = existingLead.funnelId ?? null;
    const currentFunnelId = existingLead.funnelId ?? null;
    const currentSortOrder =
      existingLead.currentStepSortOrder != null
        ? existingLead.currentStepSortOrder
        : null;
    const canAdvance =
      resolvedStep &&
      shouldAdvanceLeadStep(
        currentFunnelId,
        currentSortOrder,
        resolvedStep.funnelId,
        resolvedStep.sortOrder
      );
    await db
      .update(leads)
      .set({
        lastSeenAt: receivedAt,
        updatedAt: new Date(),
        ...(email && { email, normalizedEmail }),
        ...(name && { name }),
        ...(phone && { phone, normalizedPhone }),
        ...(canAdvance && {
          funnelId: resolvedStep.funnelId,
          currentFunnelStepId: resolvedStep.funnelStepId,
        }),
      })
      .where(eq(leads.id, leadId));

    // Follow-up engine roda em job dedicado para evitar varredura síncrona.
  } else {
    const [insertedLead] = await db
      .insert(leads)
      .values({
        tenantId,
        status: LEAD_STATUS,
        sourceIntegrationId,
        sourceProvider: SOURCE_PROVIDER,
        sourceExternalId,
        email: email ?? null,
        normalizedEmail: normalizedEmail ?? null,
        name: name ?? null,
        phone: phone ?? null,
        normalizedPhone: normalizedPhone ?? null,
        firstSeenAt: receivedAt,
        lastSeenAt: receivedAt,
        ...(resolvedStep && {
          funnelId: resolvedStep.funnelId,
          currentFunnelStepId: resolvedStep.funnelStepId,
        }),
      })
      .returning({ id: leads.id });
    if (!insertedLead) {
      await db
        .update(typebotWebhookEvents)
        .set({
          processingError: "Failed to create lead",
          processedAt: new Date(),
        })
        .where(eq(typebotWebhookEvents.id, rawEventId));
      return { error: "Failed to create lead" };
    }
    leadId = insertedLead.id;
    leadFunnelId = resolvedStep?.funnelId ?? null;

    const utm = getUtmFromPayload(payload);
    const hasUtm =
      utm.utmSource || utm.utmMedium || utm.utmCampaign || utm.utmTerm || utm.utmContent;
    if (hasUtm) {
      await db.insert(utmAttributions).values({
        tenantId,
        leadId,
        touchType: "first_touch",
        touchSequence: 1,
        touchedAt: receivedAt,
        utmSource: utm.utmSource,
        utmMedium: utm.utmMedium,
        utmCampaign: utm.utmCampaign,
        utmTerm: utm.utmTerm,
        utmContent: utm.utmContent,
      });
    }

    await notifyTenantUsers(tenantId, {
      type: "lead_created",
      title: "Novo lead recebido",
      message: `Novo lead entrou no funil (${name ?? email ?? phone ?? "sem identificação"}).`,
      resourceType: "lead",
      resourceId: leadId,
    });
  }

  await ensureFollowupTaskForLead({
    tenantId,
    leadId,
    funnelId: leadFunnelId,
    reason: existingLead ? "status_changed" : "lead_created",
    currentStatus: LEAD_STATUS,
  });
  await enqueueDueFollowupsForTenant(tenantId);

  const payloadWithRawId = { ...payload, _rawEventId: rawEventId };
  const existingEvents = await db
    .select({ id: leadEvents.id, payload: leadEvents.payload })
    .from(leadEvents)
    .where(eq(leadEvents.leadId, leadId));
  const alreadyProcessed = existingEvents.some(
    (e) => (e.payload as Record<string, unknown>)?._rawEventId === rawEventId
  );
  if (!alreadyProcessed) {
    await db.insert(leadEvents).values({
      tenantId,
      leadId,
      eventType: EVENT_TYPE,
      payload: payloadWithRawId,
      occurredAt: receivedAt,
      sourceIntegrationId,
      ...(resolvedStep && { funnelStepId: resolvedStep.funnelStepId }),
    });
  }

  await db
    .update(typebotWebhookEvents)
    .set({ processedAt: new Date() })
    .where(eq(typebotWebhookEvents.id, rawEventId));

  return { ok: true };
}

