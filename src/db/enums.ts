/**
 * Enums de banco (PostgreSQL) usados no schema.
 * Alterar valores exige migration (ALTER TYPE); adicionar no final é mais seguro.
 */
import { pgEnum } from "drizzle-orm/pg-core";

/** Provedor de integração / origem externa */
export const providerEnum = pgEnum("provider_enum", [
  "google_ads",
  "typebot",
  "evolution",
  "uazapi",
  "chatwoot",
  "whatsapp_cloud",
]);

/** Status do lead no funil */
export const leadStatusEnum = pgEnum("lead_status_enum", [
  "new",
  "contacted",
  "qualified",
  "converted",
  "lost",
  "duplicate",
  "bad_lead",
]);

/** Status da conversa (ex.: WhatsApp) */
export const conversationStatusEnum = pgEnum("conversation_status_enum", [
  "open",
  "closed",
  "archived",
]);

/** Resultado da classificação IA */
export const classificationTypeEnum = pgEnum("classification_type_enum", [
  "sale",
  "loss",
  "abandonment",
  "no_response",
  "bad_lead",
  "duplicate",
  "rescheduled",
  "other",
]);

/** Severidade do alerta */
export const alertSeverityEnum = pgEnum("alert_severity_enum", [
  "info",
  "warning",
  "critical",
]);

/** Status do alerta (vida útil) */
export const alertStatusEnum = pgEnum("alert_status_enum", [
  "active",
  "acknowledged",
  "resolved",
]);

/** Estágio de oportunidade comercial */
export const opportunityStageEnum = pgEnum("opportunity_stage_enum", [
  "open",
  "qualified",
  "negotiating",
  "won",
  "lost",
]);

/** Status de reclamação (complaint) */
export const complaintStatusEnum = pgEnum("complaint_status_enum", [
  "open",
  "in_progress",
  "closed",
]);

/** Origem do alerta */
export const alertSourceTypeEnum = pgEnum("alert_source_type_enum", [
  "kpi_rule",
  "system",
  "integration",
  "manual",
]);

/** Tipo de regra de KPI */
export const kpiRuleTypeEnum = pgEnum("kpi_rule_type_enum", [
  "threshold_below",
  "threshold_above",
  "change_percent",
  "absence",
]);

/** Ação registrada na auditoria */
export const auditActionEnum = pgEnum("audit_action_enum", [
  "login",
  "logout",
  "tenant_switch",
  "create",
  "update",
  "delete",
  "password_change",
  "membership_change",
  "integration_change",
]);
