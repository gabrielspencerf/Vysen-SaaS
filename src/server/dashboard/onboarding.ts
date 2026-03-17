/**
 * Onboarding: etapas mestres e progresso por tenant.
 */

import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  onboardingSteps,
  tenantOnboardingProgress,
} from "@/db/schema";

export interface OnboardingStepRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
}

export interface OnboardingStepWithProgress extends OnboardingStepRow {
  completedAt: Date | null;
}

export async function listOnboardingStepsWithProgress(
  tenantId: string
): Promise<OnboardingStepWithProgress[]> {
  const db = getDb();
  const steps = await db
    .select()
    .from(onboardingSteps)
    .orderBy(asc(onboardingSteps.sortOrder));
  const progress = await db
    .select({
      onboardingStepId: tenantOnboardingProgress.onboardingStepId,
      completedAt: tenantOnboardingProgress.completedAt,
    })
    .from(tenantOnboardingProgress)
    .where(eq(tenantOnboardingProgress.tenantId, tenantId));
  const progressByStep = new Map(
    progress.map((p) => [p.onboardingStepId, p.completedAt])
  );
  return steps.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    description: s.description,
    sortOrder: s.sortOrder,
    completedAt: progressByStep.get(s.id) ?? null,
  }));
}

export async function completeOnboardingStepForTenant(
  tenantId: string,
  stepId: string
): Promise<{ ok: true } | { ok: false; error: "not_found" | "already_completed" }> {
  const db = getDb();
  const [step] = await db
    .select({ id: onboardingSteps.id })
    .from(onboardingSteps)
    .where(eq(onboardingSteps.id, stepId))
    .limit(1);
  if (!step) return { ok: false, error: "not_found" };

  const [existing] = await db
    .select()
    .from(tenantOnboardingProgress)
    .where(
      and(
        eq(tenantOnboardingProgress.tenantId, tenantId),
        eq(tenantOnboardingProgress.onboardingStepId, stepId)
      )
    )
    .limit(1);
  if (existing) return { ok: false, error: "already_completed" };

  await db.insert(tenantOnboardingProgress).values({
    tenantId,
    onboardingStepId: stepId,
    completedAt: new Date(),
  });
  return { ok: true };
}
