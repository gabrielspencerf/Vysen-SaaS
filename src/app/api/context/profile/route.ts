import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/server/auth";
import { getDb } from "@/server/db";
import { users, userProfiles } from "@/db/schema";
import { checkRateLimit } from "@/server/security/rate-limit";

const MAX_LENGTH = { name: 255, phone: 64, jobTitle: 255, companyName: 255, website: 512, companyPhone: 64, address: 512, timezone: 64, avatarUrl: 512 };

export async function GET(request: NextRequest) {
  const session = await requireAuth(request).catch(() => null);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const db = getDb();
  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, session.user.id))
    .limit(1);

  return NextResponse.json({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    phone: profile?.phone ?? null,
    jobTitle: profile?.jobTitle ?? null,
    companyName: profile?.companyName ?? null,
    companyWebsite: profile?.companyWebsite ?? null,
    companyPhone: profile?.companyPhone ?? null,
    companyAddress: profile?.companyAddress ?? null,
    timezone: profile?.timezone ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
  });
}

export async function PATCH(request: NextRequest) {
  let session;
  try {
    session = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const limiter = await checkRateLimit({
    request,
    bucket: "profile:update",
    max: 20,
    windowSeconds: 60,
  });
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: { "Retry-After": String(limiter.retryAfterSeconds) },
      }
    );
  }

  let body: {
    name?: string;
    phone?: string;
    jobTitle?: string;
    companyName?: string;
    companyWebsite?: string;
    companyPhone?: string;
    companyAddress?: string;
    timezone?: string;
    avatarUrl?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const name = body.name !== undefined ? (body.name?.trim() || null) : undefined;
  if (name !== undefined && name && name.length > MAX_LENGTH.name) {
    return NextResponse.json(
      { error: "Nome excede 255 caracteres" },
      { status: 400 }
    );
  }

  const db = getDb();

  if (name !== undefined) {
    await db
      .update(users)
      .set({ name, updatedAt: new Date() })
      .where(eq(users.id, session.user.id));
  }

  const profileFields = {
    phone: body.phone !== undefined ? (body.phone?.trim()?.slice(0, MAX_LENGTH.phone) || null) : undefined,
    jobTitle: body.jobTitle !== undefined ? (body.jobTitle?.trim()?.slice(0, MAX_LENGTH.jobTitle) || null) : undefined,
    companyName: body.companyName !== undefined ? (body.companyName?.trim()?.slice(0, MAX_LENGTH.companyName) || null) : undefined,
    companyWebsite: body.companyWebsite !== undefined ? (body.companyWebsite?.trim()?.slice(0, MAX_LENGTH.website) || null) : undefined,
    companyPhone: body.companyPhone !== undefined ? (body.companyPhone?.trim()?.slice(0, MAX_LENGTH.companyPhone) || null) : undefined,
    companyAddress: body.companyAddress !== undefined ? (body.companyAddress?.trim()?.slice(0, MAX_LENGTH.address) || null) : undefined,
    timezone: body.timezone !== undefined ? (body.timezone?.trim()?.slice(0, MAX_LENGTH.timezone) || null) : undefined,
    avatarUrl: body.avatarUrl !== undefined ? (body.avatarUrl?.trim()?.slice(0, MAX_LENGTH.avatarUrl) || null) : undefined,
  };
  const setProfile = Object.fromEntries(
    Object.entries(profileFields).filter(([, v]) => v !== undefined)
  );
  if (Object.keys(setProfile).length > 0) {
    const [existing] = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(eq(userProfiles.userId, session.user.id))
      .limit(1);
    if (existing) {
      await db
        .update(userProfiles)
        .set({ ...setProfile, updatedAt: new Date() })
        .where(eq(userProfiles.userId, session.user.id));
    } else {
      await db.insert(userProfiles).values({
        userId: session.user.id,
        ...setProfile,
      });
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
