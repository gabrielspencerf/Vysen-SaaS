export { getDashboardTenantContext } from "./context";
export type { DashboardTenantContext } from "./context";
export { getHomeSummaryForTenant } from "./home";
export type { HomeSummary } from "./home";
export { getAnalyticsSummaryForTenant } from "./analytics";
export type {
  AnalyticsSummary,
  AnalyticsSummaryOptions,
  AnalyticsAdsPeriodTotals,
  AnalyticsTopCampaignRow,
  LeadsByDayRow,
  AdsSpendByWeekRow,
  LeadsByAccountRow,
  ConversationsByAccountRow,
} from "./analytics";
export { listLeadsForTenant } from "./leads";
export type { LeadRow, ListLeadsOptions } from "./leads";
export {
  listContactsForTenant,
  createContactForTenant,
  updateContactForTenant,
  deleteContactForTenant,
  getContactByIdForTenant,
} from "./contacts";
export type {
  ContactRow,
  ListContactsOptions,
  CreateContactInput,
  UpdateContactInput,
} from "./contacts";
export { importLeadsFromCsv } from "./leads-import";
export type { CsvLeadRow, ImportLeadResult } from "./leads-import";
export { importContactsFromCsv } from "./contacts-import";
export type { CsvContactRow, ImportContactResult } from "./contacts-import";
export { getLeadDetailForTenant } from "./lead-detail";
export type {
  LeadDetail,
  LeadDetailUtm,
  LeadDetailEvent,
  LeadDetailConversation,
} from "./lead-detail";
export {
  updateLeadForTenant,
  createLeadForTenant,
  deleteLeadForTenant,
} from "./lead-update";
export type { UpdateLeadInput, CreateLeadInput } from "./lead-update";
export { listConversationsForTenant } from "./conversations";
export type {
  ConversationRow,
  ListConversationsOptions,
} from "./conversations";
export { getConversationDetailForTenant } from "./conversation-detail";
export type {
  ConversationDetail,
  ConversationDetailMessage,
} from "./conversation-detail";
export { listGoogleAdsAccountsForTenant, listCampaignSnapshotsForTenant } from "./google-ads";
export type {
  GoogleAdsAccountRow,
  CampaignSnapshotRow,
  ListCampaignSnapshotsOptions,
  ListCampaignSnapshotsResult,
} from "./google-ads";
export {
  listMetaAdsAccountsForTenant,
  listMetaInsightSnapshotsForTenant,
} from "./meta-ads";
export type {
  MetaAdsAccountListRow,
  MetaInsightSnapshotRow,
  ListMetaInsightSnapshotsOptions,
  ListMetaInsightSnapshotsResult,
} from "./meta-ads";
export { buildMetaCapiPreviewForTenant, listLeadsForCapiSend } from "./meta-capi";
export type { MetaCapiPreviewResult, MetaCapiPreviewRow } from "./meta-capi";
export {
  listClarityConnectionsForTenant,
  listLatestClaritySnapshotsForTenant,
} from "./clarity-dashboard";
export type { ClaritySnapshotListRow } from "./clarity-dashboard";
export { getCampaignAttributionForTenant } from "./attribution";
export type {
  CampaignAttributionRow,
  CampaignAttributionResult,
  CampaignAttributionOptions,
  AttributionSummary,
  AttributionMatchType,
} from "./attribution";
export { getFunnelOverviewForTenant } from "./funnel";
export type {
  FunnelOverviewRow,
  FunnelOverviewOptions,
  FunnelStepVolume,
} from "./funnel";
export {
  listFunnelsForTenant,
  getFunnelWithStepsForTenant,
  createFunnelForTenant,
  updateFunnelForTenant,
  deleteFunnelForTenant,
  createFunnelStepForTenant,
  updateFunnelStepForTenant,
  deleteFunnelStepForTenant,
  getDefaultFunnelIdForTenant,
  setDefaultFunnelIdForTenant,
} from "./funnel-config";
export type {
  FunnelRow,
  FunnelStepRow,
  FunnelWithStepsRow,
  CreateFunnelInput,
  UpdateFunnelInput,
  CreateFunnelStepInput,
  UpdateFunnelStepInput,
} from "./funnel-config";
export {
  listOpportunitiesForTenant,
  getOpportunityForTenant,
  updateOpportunityForTenant,
  createOpportunityForTenant,
  deleteOpportunityForTenant,
} from "./opportunities";
export type {
  OpportunityRow,
  UpdateOpportunityInput,
} from "./opportunities";
export { listProductsForTenant, createProductForTenant, computeMrrForTenant } from "./products";
export type { ProductRow } from "./products";
export { listComplaintsForTenant, createComplaintForTenant } from "./complaints";
export type { ComplaintRow } from "./complaints";
export {
  listOnboardingStepsWithProgress,
  completeOnboardingStepForTenant,
} from "./onboarding";
export type {
  OnboardingStepWithProgress,
  OnboardingStepRow,
} from "./onboarding";
export {
  getLandingPageUrlForTenant,
  setLandingPageUrlForTenant,
  listPageSpeedResultsForTenant,
  savePageSpeedResult,
} from "./pagespeed";
export type { PageSpeedResultRow } from "./pagespeed";
export {
  listTenantAssets,
  createTenantAsset,
  getTenantAssetById,
  deleteTenantAsset,
} from "./tenant-assets";
export type { TenantAssetRow } from "./tenant-assets";
