/**
 * Detalhe de conversa por tenant. Retorna null se a conversa não existir ou não pertencer ao tenant.
 * Suporta conversas de Evolution e UAZAPI.
 */

import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  conversations,
  conversationMessages,
  evolutionInstances,
  uazapiInstances,
  leads,
} from "@/db/schema";

export interface ConversationDetailMessage {
  id: string;
  direction: string;
  contentType: string;
  contentText: string | null;
  sentAt: Date;
}

export interface ConversationDetail {
  id: string;
  externalId: string;
  status: string;
  startedAt: Date;
  lastSyncedAt: Date | null;
  instanceDisplay: string;
  leadId: string | null;
  leadName: string | null;
  leadEmail: string | null;
  messages: ConversationDetailMessage[];
}

/**
 * Carrega conversa pelo id garantindo tenant_id. Retorna null se não existir ou não for do tenant.
 */
export async function getConversationDetailForTenant(
  tenantId: string,
  conversationId: string
): Promise<ConversationDetail | null> {
  const db = getDb();

  const [row] = await db
    .select({
      id: conversations.id,
      externalId: conversations.externalId,
      status: conversations.status,
      startedAt: conversations.startedAt,
      lastSyncedAt: conversations.lastSyncedAt,
      leadId: conversations.leadId,
      evolutionInstanceName: evolutionInstances.instanceName,
      evolutionInstanceExternalId: evolutionInstances.externalId,
      uazapiInstanceName: uazapiInstances.instanceName,
      uazapiInstanceExternalId: uazapiInstances.externalId,
      leadName: leads.name,
      leadEmail: leads.email,
    })
    .from(conversations)
    .leftJoin(
      evolutionInstances,
      eq(conversations.evolutionInstanceId, evolutionInstances.id)
    )
    .leftJoin(
      uazapiInstances,
      eq(conversations.uazapiInstanceId, uazapiInstances.id)
    )
    .leftJoin(leads, eq(conversations.leadId, leads.id))
    .where(
      and(
        eq(conversations.tenantId, tenantId),
        eq(conversations.id, conversationId)
      )
    )
    .limit(1);

  if (!row) return null;

  const messages = await db
    .select({
      id: conversationMessages.id,
      direction: conversationMessages.direction,
      contentType: conversationMessages.contentType,
      contentText: conversationMessages.contentText,
      sentAt: conversationMessages.sentAt,
    })
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(asc(conversationMessages.sentAt));

  const evolutionDisplay =
    (row.evolutionInstanceName && row.evolutionInstanceName.trim()) ||
    row.evolutionInstanceExternalId ||
    "";
  const uazapiDisplay =
    (row.uazapiInstanceName && row.uazapiInstanceName.trim()) ||
    row.uazapiInstanceExternalId ||
    "";
  const instanceDisplay = evolutionDisplay || uazapiDisplay || row.id;

  return {
    id: row.id,
    externalId: row.externalId,
    status: row.status,
    startedAt: row.startedAt,
    lastSyncedAt: row.lastSyncedAt,
    instanceDisplay,
    leadId: row.leadId,
    leadName: row.leadName,
    leadEmail: row.leadEmail,
    messages: messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      contentType: m.contentType,
      contentText: m.contentText,
      sentAt: m.sentAt,
    })),
  };
}
