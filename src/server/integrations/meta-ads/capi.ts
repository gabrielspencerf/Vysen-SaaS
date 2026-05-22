/**
 * Conversions API (CAPI): montagem de eventos e envio ao pixel.
 */

import { createHash } from "crypto";
import { graphApiBaseUrl } from "./config";

function sha256Normalize(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase(), "utf8").digest("hex");
}

function hashPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return createHash("sha256").update(digits, "utf8").digest("hex");
}

function readMetadataString(metadata: Record<string, unknown> | null, ...keys: string[]): string {
  if (!metadata) return "";
  for (const key of keys) {
    const v = metadata[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function buildFbc(
  metadata: Record<string, unknown> | null,
  eventTimeSec: number
): string | undefined {
  const existing = readMetadataString(metadata, "fbc");
  if (existing.startsWith("fb.")) return existing;
  const fbclid = readMetadataString(metadata, "fbclid", "fbClid");
  if (!fbclid) return undefined;
  return `fb.1.${eventTimeSec}.${fbclid}`;
}

export interface CapiLeadInput {
  id: string;
  status: "qualified" | "converted";
  email: string | null;
  phone: string | null;
  lastSeenAt: Date;
  metadata: Record<string, unknown> | null;
  currency?: string;
  value?: number;
}

export function buildCapiEventFromLead(lead: CapiLeadInput): Record<string, unknown> {
  const eventTime = Math.floor(lead.lastSeenAt.getTime() / 1000);
  const metadata = lead.metadata ?? null;
  const fbc = buildFbc(metadata, eventTime);
  const userData: Record<string, unknown> = {};
  if (lead.email) {
    userData.em = [sha256Normalize(lead.email)];
  }
  const phHash = lead.phone ? hashPhone(lead.phone) : "";
  if (phHash) userData.ph = [phHash];
  if (fbc) userData.fbc = fbc;

  const eventName = lead.status === "converted" ? "Purchase" : "Lead";
  const eventId = `${lead.id}-${eventName}`;

  const customData: Record<string, unknown> = {
    content_name: `lead_${lead.status}`,
  };
  if (typeof lead.value === "number" && Number.isFinite(lead.value)) {
    customData.value = lead.value;
    customData.currency = lead.currency ?? "BRL";
  }

  return {
    event_name: eventName,
    event_time: eventTime,
    event_id: eventId,
    action_source: "system",
    user_data: userData,
    custom_data: customData,
  };
}

export async function sendCapiEvents(
  pixelId: string,
  accessToken: string,
  events: Record<string, unknown>[]
): Promise<{ eventsReceived?: number } | { error: string }> {
  // Token vai no body (Graph API aceita) para evitar que apareça em logs de proxy/CDN
  // — antes era enviado via query string.
  const url = `${graphApiBaseUrl()}/${encodeURIComponent(pixelId)}/events`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: events, access_token: accessToken }),
  });
  const data = (await res.json()) as {
    events_received?: number;
    error?: { message?: string };
  };
  if (!res.ok) {
    return { error: data.error?.message ?? `HTTP ${res.status}` };
  }
  return { eventsReceived: data.events_received };
}
