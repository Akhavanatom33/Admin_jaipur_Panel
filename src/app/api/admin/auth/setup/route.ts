import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/session";
import { anyAdminExists } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  username: z.string().trim().min(3, "نام کاربری باید حداقل ۳ حرف باشد").max(64),
  password: z.string().min(6, "رمز عبور باید حداقل ۶ کاراکتر باشد").max(128),
});

export async function POST(req: NextRequest) {
  if (await anyAdminExists()) {
    return NextResponse.json({ error: "یک حساب مدیر از قبل وجود دارد" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر" }, { status: 400 });
  }

  const { username, password } = parsed.data;
  const [created] = await db
    .insert(admins)
    .values({ username, passwordHash: hashPassword(password) })
    .returning();

  const token = await createSessionToken(created.id);
  const res = NextResponse.json({ ok: true, admin: { id: created.id, username: created.username } });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
