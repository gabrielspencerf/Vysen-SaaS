/**
 * Healthcheck público: verifica apenas se a webapp consegue servir (DB acessível).
 * Não expõe estado do worker / Redis para não criar fingerprint do stack
 * nem droga r tráfego HTTP por falhas do consumer de filas.
 *
 * Uso: GET /api/health — 200 = webapp pode servir, 503 = não pode.
 *
 * Para diagnóstico operacional (worker stale, idade do heartbeat, etc.) use
 * /api/health/details (requer token via HEALTH_DETAILS_TOKEN).
 */
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbOk = false;
  try {
    const db = getDb();
    await db.execute(sql`select 1`);
    dbOk = true;
  } catch (err) {
    console.error("Health check failed (db):", err);
  }

  return NextResponse.json(
    { ok: dbOk },
    {
      status: dbOk ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
