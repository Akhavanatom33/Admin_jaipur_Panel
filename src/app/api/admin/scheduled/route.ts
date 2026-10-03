import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { scheduledPosts } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(scheduledPosts).orderBy(desc(scheduledPosts.scheduledAt));
  return NextResponse.json(rows);
}

const schema = z.object({
  message: z.string().trim().min(1, "متن پیام الزامی است"),
  chatIds: z.array(z.string()).min(1, "حداقل یک گروه را انتخاب کنید"),
  scheduledAt: z.string().min(1, "زمان ارسال الزامی است"),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر" }, { status: 400 });
  }

  const scheduledAt = new Date(parsed.data.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: "تاریخ/ساعت نامعتبر است" }, { status: 400 });
  }

  const [created] = await db
    .insert(scheduledPosts)
    .values({
      message: parsed.data.message,
      chatIds: parsed.data.chatIds,
      scheduledAt,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
