import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { logs } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

const schema = z.object({
  message: z.string().trim().min(1, "متن پیام الزامی است"),
  chatIds: z.array(z.string()).min(1, "حداقل یک گروه را انتخاب کنید"),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر" }, { status: 400 });
  }

  const settings = await getSettings();
  if (!settings.botToken) {
    return NextResponse.json({ error: "ابتدا توکن ربات را در تنظیمات وارد کنید" }, { status: 400 });
  }

  const results: { chatId: string; ok: boolean; error?: string }[] = [];

  for (const chatId of parsed.data.chatIds) {
    const result = await sendTelegramMessage(settings.botToken, chatId, parsed.data.message);
    results.push({ chatId, ok: result.ok, error: result.ok ? undefined : result.error });
    await db.insert(logs).values({
      source: "broadcast",
      chatId,
      messagePreview: parsed.data.message.slice(0, 500),
      status: result.ok ? "success" : "failed",
      error: result.ok ? null : result.error,
    });
  }

  return NextResponse.json({ results });
}
