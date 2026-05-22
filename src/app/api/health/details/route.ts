/**
 * Health details (operacional): retorna estado completo de db/redis/worker.
 *
 * Requer header `Authorization: Bearer <HEALTH_DETAILS_TOKEN>`.
 *
 * Se HEALTH_DETAILS_TOKEN não estiver configurado, o endpoint responde 404
 * (não-funcional) — escolha deliberada para evitar exposição acidental em
 * ambientes mal configurados. Para usar em produção, defina o token no env e
 * configure o monitor (Uptime/Prometheus) para enviar no header.
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { timingSafeEqual } from "crypto";
import { getDb } from "@/server/db";
import { createRedisClient } from "@/server/redis";
import { HEARTBEAT_KEY, MAX_AGE_MS } from "@/workers/readiness";

export const dynamic = "force-dynamic";

function checkAuth(request: NextRequest): boolean {
  const expected = process.env.HEALTH_DETAILS_TOKEN;
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const provided = match[1].trim();
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    // 404 (não 401) — não revela que o endpoint existe sem o token correto.
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  let dbOk = false;
  let redisOk = false;
  let workerStatus: "ok" | "stale" | "missing" | "error" = "missing";
  let workerHeartbeatAgeMs: number | null = null;
  let workerLastHeartbeatAt: string | null = null;

  try {
    const db = getDb();
    await db.execute(sql`select 1`);
    dbOk = true;
  } catch (err) {
    console.error("Health details failed (db):", err);
  }

  const redis = createRedisClient();
  try {
    const heartbeatRaw = await redis.get(HEARTBEAT_KEY);
    redisOk = true;
    if (!heartbeatRaw) {
      workerStatus = "missing";
    } else {
      const ts = Number(heartbeatRaw);
      if (Number.isFinite(ts)) {
        workerHeartbeatAgeMs = Date.now() - ts;
        workerLastHeartbeatAt = new Date(ts).toISOString();
        workerStatus = workerHeartbeatAgeMs <= MAX_AGE_MS ? "ok" : "stale";
      } else {
        workerStatus = "stale";
      }
    }
  } catch (err) {
    console.error("Health details failed (redis):", err);
    workerStatus = "error";
  } finally {
    await redis.quit().catch(() => {});
  }

  const ok = dbOk && redisOk && workerStatus === "ok";
  return NextResponse.json(
    {
      ok,
      db: dbOk ? "ok" : "error",
      redis: redisOk ? "ok" : "error",
      worker: workerStatus,
      workerHeartbeatAgeMs,
      workerLastHeartbeatAt,
    },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
