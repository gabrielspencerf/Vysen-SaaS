import { index, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { tenants } from "../auth/tenants";
import { onboardingSteps } from "./onboarding-steps";

/**
 * Progresso de onboarding por tenant: qual etapa foi concluída e quando.
 */
export const tenantOnboardingProgress = pgTable(
  "tenant_onboarding_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    onboardingStepId: uuid("onboarding_step_id")
      .notNull()
      .references(() => onboardingSteps.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", { withTimezone: true, precision: 6 })
      .notNull(),
  },
  (t) => ({
    tenant_onboarding_tenant_idx: index("tenant_onboarding_tenant_idx").on(
      t.tenantId
    ),
    tenant_onboarding_tenant_step_unique: unique(
      "tenant_onboarding_tenant_step_unique"
    ).on(t.tenantId, t.onboardingStepId),
  })
);
