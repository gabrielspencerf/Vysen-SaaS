/**
 * Payloads de jobs nas filas Redis.
 * Ver docs/BASE2_ETAPA1.md.
 */

export interface JobProcessTypebotRaw {
  type: "process_typebot_raw";
  rawEventId: string;
  tenantId: string;
  typebotBotId: string;
  attempt?: number;
}

export interface JobProcessEvolutionRaw {
  type: "process_evolution_raw";
  rawEventId: string;
  tenantId: string;
  evolutionInstanceId: string;
  attempt?: number;
}

export interface JobProcessUazapiRaw {
  type: "process_uazapi_raw";
  rawEventId: string;
  tenantId: string;
  uazapiInstanceId: string;
  attempt?: number;
}

export interface JobSyncGoogleAdsAccount {
  type: "sync_google_ads_account";
  accountId: string;
  attempt?: number;
}

export type JobPayload =
  | JobProcessTypebotRaw
  | JobProcessEvolutionRaw
  | JobProcessUazapiRaw
  | JobSyncGoogleAdsAccount;

export const QUEUE_RAW_TYPEBOT = "queue:raw:typebot";
export const QUEUE_RAW_EVOLUTION = "queue:raw:evolution";
export const QUEUE_RAW_UAZAPI = "queue:raw:uazapi";
export const QUEUE_SYNC_GOOGLE_ADS = "queue:sync:google-ads";
export const DLQ_RAW_TYPEBOT = "queue:dlq:typebot";
export const DLQ_RAW_EVOLUTION = "queue:dlq:evolution";
export const DLQ_RAW_UAZAPI = "queue:dlq:uazapi";
export const DLQ_SYNC_GOOGLE_ADS = "queue:dlq:google-ads";
