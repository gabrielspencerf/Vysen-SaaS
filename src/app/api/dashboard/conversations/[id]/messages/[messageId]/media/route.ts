/**
 * GET /api/dashboard/conversations/[id]/messages/[messageId]/media
 * Serve mídia (imagem/áudio) de uma mensagem de conversa com escopo por tenant.
 */
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import { getDb } from "@/server/db";
import {
  conversationMessages,
  conversations,
  evolutionInstances,
  uazapiInstances,
} from "@/db/schema";
import { getEvolutionInstanceSecret } from "@/server/integrations/evolution/credentials";
import { fetchEvolutionMediaAsBuffer } from "@/server/integrations/evolution/fetch-media";
import {
  extractInlineMediaBufferFromPayload,
  extractMediaUrlFromPayload,
} from "@/server/integrations/media/payload-media";
import { getUazapiInstanceSecret } from "@/server/integrations/uazapi/credentials";

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function toAbsoluteUrl(rawUrl: string, baseUrl: string): URL | null {
  try {
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
      return new URL(rawUrl);
    }
    const base = new URL(baseUrl);
    return new URL(rawUrl, base);
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const { id: conversationId, messageId } = await params;
  if (!conversationId || !messageId) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;

      const db = getDb();
      const [row] = await db
        .select({
          contentType: conversationMessages.contentType,
          externalId: conversationMessages.externalId,
          payload: conversationMessages.payload,
          evolutionInstanceId: conversations.evolutionInstanceId,
          uazapiInstanceId: conversations.uazapiInstanceId,
        })
        .from(conversationMessages)
        .innerJoin(conversations, eq(conversationMessages.conversationId, conversations.id))
        .where(
          and(
            eq(conversations.tenantId, tenantId),
            eq(conversations.id, conversationId),
            eq(conversationMessages.id, messageId)
          )
        )
        .limit(1);

      if (!row) {
        return NextResponse.json({ error: "Mensagem não encontrada" }, { status: 404 });
      }

      const mediaType = row.contentType === "image" || row.contentType === "audio"
        ? row.contentType
        : null;

      if (!mediaType) {
        return NextResponse.json({ error: "Mensagem não contém mídia suportada" }, { status: 400 });
      }

      const payload = (row.payload as Record<string, unknown> | null) ?? null;
      if (payload) {
        const inlineMedia = extractInlineMediaBufferFromPayload(payload, mediaType);
        if (inlineMedia) {
          return new NextResponse(new Uint8Array(inlineMedia.buffer), {
            headers: {
              "Content-Type":
                inlineMedia.mimeType ??
                (mediaType === "image" ? "image/jpeg" : "audio/ogg"),
              "Content-Disposition": "inline",
              "Cache-Control": "private, max-age=60",
            },
          });
        }
      }

      // Tenta URL de mídia no payload para ambos os provedores.
      if (payload) {
        const mediaUrlFromPayload = extractMediaUrlFromPayload(payload, mediaType);
        if (mediaUrlFromPayload) {
          if (row.uazapiInstanceId) {
            const [uazapi] = await db
              .select({
                id: uazapiInstances.id,
                baseUrl: uazapiInstances.baseUrl,
              })
              .from(uazapiInstances)
              .where(eq(uazapiInstances.id, row.uazapiInstanceId))
              .limit(1);

            if (uazapi) {
              const mediaUrl = toAbsoluteUrl(mediaUrlFromPayload, uazapi.baseUrl);
              const base = toAbsoluteUrl(uazapi.baseUrl, uazapi.baseUrl);
              if (mediaUrl && base && mediaUrl.host === base.host) {
                const apiKey = await getUazapiInstanceSecret(uazapi.id);
                try {
                  const response = await fetchWithTimeout(
                    mediaUrl.toString(),
                    {
                      method: "GET",
                      headers: apiKey ? { apikey: apiKey } : undefined,
                      redirect: "manual",
                    },
                    8000
                  );
                  if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    return new NextResponse(new Uint8Array(arrayBuffer), {
                      headers: {
                        "Content-Type":
                          response.headers.get("content-type") ??
                          (mediaType === "image" ? "image/jpeg" : "audio/ogg"),
                        "Content-Disposition": "inline",
                        "Cache-Control": "private, max-age=60",
                      },
                    });
                  }
                } catch {
                  // segue para próximos fallbacks
                }
              }
            }
          }

          // Não buscar URLs públicas arbitrárias do payload para evitar SSRF.
        }
      }

      if (!row.evolutionInstanceId || !row.externalId) {
        return NextResponse.json(
          { error: "Mídia não disponível para este provedor" },
          { status: 404 }
        );
      }

      const [evolution] = await db
        .select({
          id: evolutionInstances.id,
          baseUrl: evolutionInstances.baseUrl,
          externalId: evolutionInstances.externalId,
        })
        .from(evolutionInstances)
        .where(eq(evolutionInstances.id, row.evolutionInstanceId))
        .limit(1);

      if (!evolution) {
        return NextResponse.json(
          { error: "Instância da integração não encontrada" },
          { status: 404 }
        );
      }

      const apiKey = await getEvolutionInstanceSecret(evolution.id);
      const media = await fetchEvolutionMediaAsBuffer({
        baseUrl: evolution.baseUrl,
        instanceName: evolution.externalId,
        apiKey,
        messageId: row.externalId,
      });

      if (!media) {
        return NextResponse.json({ error: "Não foi possível obter a mídia" }, { status: 404 });
      }

      return new NextResponse(new Uint8Array(media.buffer), {
        headers: {
          "Content-Type":
            media.mimeType ?? (mediaType === "image" ? "image/jpeg" : "audio/ogg"),
          "Content-Disposition": "inline",
          "Cache-Control": "private, max-age=60",
        },
      });
    }, PERMISSION_SLUGS.LEADS_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
