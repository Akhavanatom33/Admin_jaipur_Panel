import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "@/lib/password";
import { getCurrentAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, "رمز عبور جدید باید حداقل ۶ کاراکتر باشد"),
});

export async function POST(req: NextRequest) {
  const currentAdmin = await getCurrentAdmin();
  if (!currentAdmin) {
    return NextResponse.json({ error: "نیاز به ورود دارید" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر" }, { status: 400 });
  }

  const rows = await db.select().from(admins).where(eq(admins.id, currentAdmin.id)).limit(1);
  const admin = rows[0];
  if (!admin || !verifyPassword(parsed.data.currentPassword, admin.passwordHash)) {
    return NextResponse.json({ error: "رمز عبور فعلی اشتباه است" }, { status: 401 });
  }

  await db
    .update(admins)
    .set({ passwordHash: hashPassword(parsed.data.newPassword) })
    .where(eq(admins.id, admin.id));

  return NextResponse.json({ ok: true });
}
