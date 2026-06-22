import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { createRedisClient } from "@/server/redis";
import { env } from "@/config/env";

function clientIpFromRequest(request: NextRequest): string {
  const trustedHops = env.rateLimitTrustedProxyHops;
  const forwardedFor = request.headers.get("x-forwarded-for")?.trim();
  if (trustedHops > 0 && forwardedFor) {
    const chain = forwardedFor
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (chain.length > 0) {
      // Exemplo: client, proxy1, proxy2. Com 1 hop confiável => lê proxy1 anterior.
      const index = Math.max(0, chain.length - trustedHops - 1);
      return chain[index] ?? "unknown";
    }
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function hashKeyPart(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export interface RateLimitInput {
  request: NextRequest;
  bucket: string;
  max: number;
  windowSeconds: number;
  resourceKey?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function checkRateLimit(
  input: RateLimitInput
): Promise<RateLimitResult> {
  // Em desenvolvimento local, permitimos fallback sem Redis para não bloquear
  // login e fluxos básicos quando a infra assíncrona ainda não foi configurada.
  if (!process.env.REDIS_URL && env.isDev) {
    return {
      allowed: true,
      remaining: input.max,
      retryAfterSeconds: input.windowSeconds,
    };
  }

  const ip = clientIpFromRequest(input.request);
  const resource = input.resourceKey ? hashKeyPart(input.resourceKey) : "any";
  const key = `ratelimit:${input.bucket}:${hashKeyPart(ip)}:${resource}`;
  let redis: ReturnType<typeof createRedisClient> | null = null;

  try {
    redis = createRedisClient();
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, input.windowSeconds);
    }
    const ttl = await redis.ttl(key);
    const retryAfterSeconds = ttl > 0 ? ttl : input.windowSeconds;
    const remaining = Math.max(0, input.max - count);
    return {
      allowed: count <= input.max,
      remaining,
      retryAfterSeconds,
    };
  } catch (error) {
    if (env.isDev) {
      return {
        allowed: true,
        remaining: input.max,
        retryAfterSeconds: input.windowSeconds,
      };
    }
    throw error;
  } finally {
    if (redis) {
      redis.quit();
    }
  }
}
