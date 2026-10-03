import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { chats } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getSettings } from "@/lib/settings";
import { getTelegramChat } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(chats).orderBy(desc(chats.addedAt));
  return NextResponse.json(rows);
}

const schema = z.object({
  chatId: z.string().trim().min(1, "شناسه چت الزامی است"),
  title: z.string().trim().optional(),
  type: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر" }, { status: 400 });
  }

  let { title, type } = parsed.data;
  const { chatId } = parsed.data;

  if (!title) {
    const settings = await getSettings();
    if (settings.botToken) {
      const info = await getTelegramChat(settings.botToken, chatId);
      if (info.ok) {
        title = info.result.title || info.result.username || info.result.first_name || chatId;
        type = info.result.type;
      }
    }
  }

  try {
    const [created] = await db
      .insert(chats)
      .values({ chatId, title: title || chatId, type: type || "group" })
      .returning();
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "این شناسه چت قبلاً ثبت شده است" }, { status: 409 });
  }
}
