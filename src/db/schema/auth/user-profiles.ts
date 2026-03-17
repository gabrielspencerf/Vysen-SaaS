import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Perfil estendido do usuário (dados da empresa, telefone, cargo, etc.).
 * 1:1 com users. Usado na tela Configurações / Perfil.
 */
export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  phone: varchar("phone", { length: 64 }),
  jobTitle: varchar("job_title", { length: 255 }),
  companyName: varchar("company_name", { length: 255 }),
  companyWebsite: varchar("company_website", { length: 512 }),
  companyPhone: varchar("company_phone", { length: 64 }),
  companyAddress: varchar("company_address", { length: 512 }),
  timezone: varchar("timezone", { length: 64 }),
  avatarUrl: varchar("avatar_url", { length: 512 }),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
