import { and, eq, lte } from "drizzle-orm";
import { followupTasks, leads } from "@/db/schema";
import { getDb } from "@/server/db";
import { getResolvedOpenAIAgentConfig } from "@/server/config/openai-agent";
import { notifyTenantUsers } from "@/server/notifications/internal";

function terminalLeadStatus(status: string | null | undefined): boolean {
  return status === "converted" || status === "lost" || status === "duplicate" || status === "bad_lead";
}

export async function ensureFollowupTaskForLead(input: {
  tenantId: string;
  leadId: string;
  funnelId: string | null;
  reason: "lead_created" | "status_changed";
  currentStatus?: string | null;
}): Promise<void> {
  if (terminalLeadStatus(input.currentStatus)) {
    await completeFollowupTasksForLead(input.tenantId, input.leadId, "completed");
    return;
  }

  const db = getDb();
  const config = await getResolvedOpenAIAgentConfig(input.tenantId);
  const rule = config.followupRules[0];
  const now = new Date();
  const dueAt = new Date(now.getTime() + rule.intervalHours * 60 * 60 * 1000);

  const [pending] = await db
    .select({ id: followupTasks.id })
    .from(followupTasks)
    .where(
      and(
        eq(followupTasks.tenantId, input.tenantId),
        eq(followupTasks.leadId, input.leadId),
        eq(followupTasks.status, "pending")
      )
    )
    .limit(1);

  if (pending) return;

  await db.insert(followupTasks).values({
    tenantId: input.tenantId,
    leadId: input.leadId,
    funnelId: input.funnelId,
    profileId: rule.profileId,
    status: "pending",
    attemptCount: 0,
    maxFollowups: rule.maxFollowups,
    intervalHours: rule.intervalHours,
    dueAt,
  });

  await notifyTenantUsers(input.tenantId, {
    type: "followup_scheduled",
    title: "Follow-up agendado",
    message:
      input.reason === "lead_created"
        ? "Novo lead entrou no funil com follow-up agendado."
        : "Mudança de status gerou novo follow-up agendado.",
    resourceType: "lead",
    resourceId: input.leadId,
  });
}

export async function completeFollowupTasksForLead(
  tenantId: string,
  leadId: string,
  status: "completed" | "skipped"
): Promise<void> {
  const db = getDb();
  await db
    .update(followupTasks)
    .set({
      status,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(followupTasks.tenantId, tenantId),
        eq(followupTasks.leadId, leadId),
        eq(followupTasks.status, "pending")
      )
    );
}

export async function processDueFollowupsForTenant(tenantId: string): Promise<void> {
  const db = getDb();
  const now = new Date();
  const dueRows = await db
    .select({
      id: followupTasks.id,
      leadId: followupTasks.leadId,
      profileId: followupTasks.profileId,
      attemptCount: followupTasks.attemptCount,
      maxFollowups: followupTasks.maxFollowups,
      intervalHours: followupTasks.intervalHours,
      consultingAgendaRaisedAt: followupTasks.consultingAgendaRaisedAt,
      leadName: leads.name,
      leadStatus: leads.status,
    })
    .from(followupTasks)
    .leftJoin(leads, eq(followupTasks.leadId, leads.id))
    .where(
      and(
        eq(followupTasks.tenantId, tenantId),
        eq(followupTasks.status, "pending"),
        lte(followupTasks.dueAt, now)
      )
    )
    .limit(50);

  for (const task of dueRows) {
    if (terminalLeadStatus(task.leadStatus)) {
      await completeFollowupTasksForLead(tenantId, task.leadId, "completed");
      continue;
    }

    const nextAttempt = task.attemptCount + 1;
    const shouldComplete = nextAttempt >= task.maxFollowups;
    const nextDueAt = new Date(now.getTime() + task.intervalHours * 60 * 60 * 1000);

    await db
      .update(followupTasks)
      .set({
        attemptCount: nextAttempt,
        lastNotifiedAt: now,
        dueAt: nextDueAt,
        status: shouldComplete ? "completed" : "pending",
        completedAt: shouldComplete ? now : null,
        updatedAt: now,
      })
      .where(eq(followupTasks.id, task.id));

    const leadDisplay = task.leadName?.trim() || "Lead sem nome";
    await notifyTenantUsers(tenantId, {
      type: shouldComplete ? "followup_limit_reached" : "followup_due",
      title: shouldComplete ? "Follow-up finalizado" : "Follow-up pendente",
      message: shouldComplete
        ? `O lead ${leadDisplay} atingiu o limite de tentativas de follow-up.`
        : `Lead ${leadDisplay} está com follow-up pendente (tentativa ${nextAttempt}/${task.maxFollowups}).`,
      resourceType: "lead",
      resourceId: task.leadId,
      metadata: {
        profileId: task.profileId,
        attemptCount: nextAttempt,
        maxFollowups: task.maxFollowups,
      },
    });

    if (!task.consultingAgendaRaisedAt && nextAttempt >= 2) {
      await db
        .update(followupTasks)
        .set({
          consultingAgendaRaisedAt: now,
          updatedAt: now,
        })
        .where(eq(followupTasks.id, task.id));

      await notifyTenantUsers(tenantId, {
        type: "commercial_consulting_agenda",
        title: "Pauta consultiva gerada",
        message:
          "A IA identificou follow-up não executado no prazo. Recomenda-se incluir em pauta de consultoria comercial.",
        resourceType: "lead",
        resourceId: task.leadId,
      });
    }
  }
}

export async function processDueFollowupsForLead(tenantId: string, leadId: string): Promise<void> {
  const db = getDb();
  const now = new Date();
  const [task] = await db
    .select({ id: followupTasks.id })
    .from(followupTasks)
    .where(
      and(
        eq(followupTasks.tenantId, tenantId),
        eq(followupTasks.leadId, leadId),
        eq(followupTasks.status, "pending"),
        lte(followupTasks.dueAt, now)
      )
    )
    .limit(1);
  if (!task) return;
  await processDueFollowupsForTenant(tenantId);
}
