import { integer, pgTable, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Etapas mestres do onboarding (globais). Ordem por sort_order.
 */
export const onboardingSteps = pgTable("onboarding_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 512 }),
  sortOrder: integer("sort_order").notNull().default(0),
});
