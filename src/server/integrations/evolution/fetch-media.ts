/**
 * Busca mídia (áudio, etc.) da Evolution via getBase64FromMediaMessage.
 * Usado pelo worker para obter o arquivo de áudio e enviar ao Whisper.
 */

export interface FetchEvolutionMediaInput {
  baseUrl: string;
  instanceName: string;
  apiKey: string | null;
  messageId: string;
}

/**
 * Retorna o áudio (ou mídia) em buffer, ou null se falhar.
 */
export async function fetchEvolutionMediaAsBuffer(
  input: FetchEvolutionMediaInput
): Promise<{ buffer: Buffer; mimeType?: string } | null> {
  const url = `${input.baseUrl.replace(/\/$/, "")}/chat/getBase64FromMediaMessage/${encodeURIComponent(input.instanceName)}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (input.apiKey?.trim()) {
    headers.apikey = input.apiKey.trim();
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: { key: { id: input.messageId } },
        convertToMp4: false,
      }),
    });

    if (!res.ok) {
      return null;
    }

    const json = (await res.json()) as Record<string, unknown>;
    const base64 =
      typeof json.base64 === "string"
        ? json.base64
        : typeof (json as { base64Data?: string }).base64Data === "string"
          ? (json as { base64Data: string }).base64Data
          : null;
    if (!base64) {
      return null;
    }

    const buffer = Buffer.from(base64, "base64");
    if (buffer.length === 0) {
      return null;
    }

    const mimeType =
      typeof json.mimetype === "string" && json.mimetype.trim()
        ? json.mimetype.trim()
        : undefined;

    return { buffer, mimeType };
  } catch {
    return null;
  }
}
