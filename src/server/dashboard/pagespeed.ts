/**
 * PageSpeed: URL da landing por tenant e histórico de resultados por data/dispositivo.
 */

import { desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { tenants, pagespeedResults } from "@/db/schema";

const LANDING_URL_KEY = "landing_page_url";

export async function getLandingPageUrlForTenant(
  tenantId: string
): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const url = row?.settings && typeof row.settings === "object" && LANDING_URL_KEY in row.settings
    ? row.settings[LANDING_URL_KEY]
    : null;
  return typeof url === "string" ? url : null;
}

export async function setLandingPageUrlForTenant(
  tenantId: string,
  url: string | null
): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const current = (row?.settings && typeof row.settings === "object"
    ? { ...row.settings }
    : {}) as Record<string, unknown>;
  if (url === null || url === "") {
    delete current[LANDING_URL_KEY];
  } else {
    current[LANDING_URL_KEY] = url;
  }
  await db
    .update(tenants)
    .set({ settings: current })
    .where(eq(tenants.id, tenantId));
}

export interface PageSpeedResultRow {
  id: string;
  url: string;
  strategy: string;
  metricDate: string;
  result: Record<string, unknown>;
  fetchedAt: Date;
}

export async function listPageSpeedResultsForTenant(
  tenantId: string,
  options: { limit?: number } = {}
): Promise<PageSpeedResultRow[]> {
  const db = getDb();
  const { limit = 60 } = options;
  const rows = await db
    .select({
      id: pagespeedResults.id,
      url: pagespeedResults.url,
      strategy: pagespeedResults.strategy,
      metricDate: pagespeedResults.metricDate,
      result: pagespeedResults.result,
      fetchedAt: pagespeedResults.fetchedAt,
    })
    .from(pagespeedResults)
    .where(eq(pagespeedResults.tenantId, tenantId))
    .orderBy(desc(pagespeedResults.metricDate), desc(pagespeedResults.fetchedAt))
    .limit(limit);
  return rows;
}

export async function savePageSpeedResult(
  tenantId: string,
  url: string,
  strategy: "mobile" | "desktop",
  result: Record<string, unknown>
): Promise<void> {
  const db = getDb();
  const today = new Date();
  const metricDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const fetchedAt = new Date();
  await db
    .insert(pagespeedResults)
    .values({
      tenantId,
      url,
      strategy,
      metricDate: metricDateStr,
      result,
      fetchedAt,
    })
    .onConflictDoUpdate({
      target: [
        pagespeedResults.tenantId,
        pagespeedResults.url,
        pagespeedResults.strategy,
        pagespeedResults.metricDate,
      ],
      set: {
        result,
        fetchedAt,
      },
    });
}
