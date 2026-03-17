/**
 * Extrair event_type e payload do body do webhook UAZAPI.
 * Formato compatível com Evolution (event, data.key.id, data) para reutilizar lógica de mensagens.
 */

export interface UazapiParsedPayload {
  eventType: string;
  payload: Record<string, unknown>;
  externalEventId: string | null;
}

function stringOrNull(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

export function parseUazapiWebhookBody(
  body: unknown
): UazapiParsedPayload | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid body" };
  }
  const obj = body as Record<string, unknown>;
  const eventType =
    typeof obj.event === "string" ? obj.event : typeof obj.type === "string" ? obj.type : "unknown";

  let externalEventId: string | null = null;
  const data = obj.data as Record<string, unknown> | undefined;
  const key = data?.key as Record<string, unknown> | undefined;
  if (key && typeof key === "object") {
    const messageId = stringOrNull(key.id) ?? stringOrNull(key.messageId);
    if (messageId) externalEventId = messageId;
  }
  if (!externalEventId && typeof obj.id === "string") {
    externalEventId = obj.id.trim() || null;
  }

  return {
    eventType,
    payload: obj as Record<string, unknown>,
    externalEventId,
  };
}
