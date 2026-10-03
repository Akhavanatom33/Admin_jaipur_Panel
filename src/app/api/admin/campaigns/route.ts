import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  return NextResponse.json(rows);
}

const schema = z.object({
  name: z.string().trim().min(1, "نام کمپین الزامی است"),
  messages: z.array(z.string().trim().min(1)).min(1, "حداقل یک پیام الزامی است"),
  chatIds: z.array(z.string()).min(1, "حداقل یک گروه را انتخاب کنید"),
  intervalSeconds: z.coerce.number().int().min(10),
  isActive: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر" }, { status: 400 });
  }

  const settings = await getSettings();
  if (parsed.data.intervalSeconds < settings.minIntervalSeconds) {
    return NextResponse.json(
      { error: `فاصله زمانی باید حداقل ${settings.minIntervalSeconds} ثانیه باشد` },
      { status: 400 },
    );
  }

  const isActive = parsed.data.isActive ?? false;
  const [created] = await db
    .insert(campaigns)
    .values({
      name: parsed.data.name,
      messages: parsed.data.messages,
      chatIds: parsed.data.chatIds,
      intervalSeconds: parsed.data.intervalSeconds,
      isActive,
      nextRunAt: isActive ? new Date() : null,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
