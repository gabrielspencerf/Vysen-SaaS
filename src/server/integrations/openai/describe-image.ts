/**
 * Descrição de imagens via OpenAI Vision (Chat Completions com modelo com visão).
 * Usa OPENAI_API_KEY do ambiente; se não definida, describeImage() retorna null.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
const CHAT_URL = "https://api.openai.com/v1/chat/completions";

/**
 * Envia a imagem para o modelo de visão e retorna uma descrição em texto.
 * @param imageBuffer - Buffer da imagem (jpeg, png, webp, etc.)
 * @param mimeType - Opcional (ex.: image/jpeg, image/png)
 * @returns Descrição da imagem ou null se chave ausente ou falha.
 */
export async function describeImage(
  imageBuffer: Buffer,
  mimeType?: string
): Promise<string | null> {
  if (!OPENAI_API_KEY || OPENAI_API_KEY.length < 10) {
    return null;
  }

  const type = mimeType?.startsWith("image/")
    ? mimeType
    : "image/jpeg";
  const base64 = imageBuffer.toString("base64");
  const dataUrl = `data:${type};base64,${base64}`;

  try {
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Descreva esta imagem de forma clara e objetiva em português. Inclua o que aparece na cena, texto visível (se houver) e elementos relevantes.",
              },
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.warn("[openai/vision] API error", { status: res.status, body: errBody.slice(0, 200) });
      return null;
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content?.trim();
    return content && content.length > 0 ? content : null;
  } catch (err) {
    console.warn("[openai/vision] request failed", err instanceof Error ? err.message : err);
    return null;
  }
}
