/**
 * Transcrição de áudio via OpenAI Whisper.
 * Usa OPENAI_API_KEY do ambiente; se não definida, transcreve() retorna null.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";

export interface TranscribeResult {
  text: string;
}

/**
 * Envia áudio para o Whisper e retorna o texto transcrito.
 * @param audioBuffer - Buffer do arquivo de áudio (ogg, mp3, m4a, wav, etc.)
 * @param mimeType - Opcional; usado como hint para o filename (ex.: audio/ogg → .ogg)
 * @returns Texto transcrito ou null se chave ausente, falha de rede ou áudio inválido.
 */
export async function transcribe(
  audioBuffer: Uint8Array,
  mimeType?: string
): Promise<string | null> {
  if (!OPENAI_API_KEY || OPENAI_API_KEY.length < 10) {
    return null;
  }

  const ext = mimeType?.includes("ogg")
    ? "ogg"
    : mimeType?.includes("mpeg") || mimeType?.includes("mp3")
      ? "mp3"
      : mimeType?.includes("m4a")
        ? "m4a"
        : mimeType?.includes("wav")
          ? "wav"
          : "webm";
  const filename = `audio.${ext}`;

  const form = new FormData();
  form.append("file", new Blob([audioBuffer], { type: mimeType ?? "audio/ogg" }), filename);
  form.append("model", "whisper-1");
  form.append("response_format", "text");

  try {
    const res = await fetch(WHISPER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: form,
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.warn("[openai/whisper] API error", { status: res.status, body: errBody.slice(0, 200) });
      return null;
    }

    const text = await res.text();
    const trimmed = text?.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch (err) {
    console.warn("[openai/whisper] request failed", err instanceof Error ? err.message : err);
    return null;
  }
}
