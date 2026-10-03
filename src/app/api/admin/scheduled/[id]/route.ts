import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { scheduledPosts } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const rows = await db.select().from(scheduledPosts).where(eq(scheduledPosts.id, Number(id))).limit(1);
  const existing = rows[0];
  if (!existing) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
  if (existing.status !== "pending") {
    return NextResponse.json({ error: "فقط پست‌های در انتظار قابل لغو هستند" }, { status: 400 });
  }

  const [updated] = await db
    .update(scheduledPosts)
    .set({ status: "cancelled" })
    .where(eq(scheduledPosts.id, Number(id)))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await db.delete(scheduledPosts).where(eq(scheduledPosts.id, Number(id)));
  return NextResponse.json({ ok: true });
}
