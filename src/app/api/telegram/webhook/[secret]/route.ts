import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { chats } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSettings } from "@/lib/settings";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  first_name?: string;
  username?: string;
}

interface TelegramMessage {
  message_id: number;
  text?: string;
  chat: TelegramChat;
  from?: { id: number; first_name?: string; username?: string };
}

interface TelegramUpdate {
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
  my_chat_member?: {
    chat: TelegramChat;
    new_chat_member: { status: string };
  };
}

async function upsertChat(chat: TelegramChat, isActive = true) {
  const chatId = String(chat.id);
  const title = chat.title || chat.username || chat.first_name || chatId;
  const existing = await db.select().from(chats).where(eq(chats.chatId, chatId)).limit(1);

  if (existing[0]) {
    await db
      .update(chats)
      .set({ title, type: chat.type, isActive })
      .where(eq(chats.chatId, chatId));
  } else {
    await db.insert(chats).values({ chatId, title, type: chat.type, isActive });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ secret: string }> },
) {
  const { secret } = await params;
  const settings = await getSettings();

  if (!settings.webhookSecret || settings.webhookSecret !== secret) {
    return NextResponse.json({ error: "invalid secret" }, { status: 403 });
  }
  if (!settings.botToken) {
    return NextResponse.json({ ok: true });
  }

  const update = (await req.json().catch(() => null)) as TelegramUpdate | null;
  if (!update) return NextResponse.json({ ok: true });

  const message = update.message || update.channel_post;

  if (message?.text) {
    const text = message.text.trim();

    if (text.startsWith("/id")) {
      await upsertChat(message.chat, true);
      await sendTelegramMessage(
        settings.botToken,
        String(message.chat.id),
        `✅ این گفتگو ثبت شد.\nشناسه: <code>${message.chat.id}</code>\nعنوان: ${message.chat.title ?? "—"}`,
      );
    } else if (text.startsWith("/myid") && message.from) {
      await sendTelegramMessage(
        settings.botToken,
        String(message.chat.id),
        `🆔 شناسه عددی شما: <code>${message.from.id}</code>`,
      );
    } else if (text.startsWith("/start") && message.chat.type === "private") {
      await sendTelegramMessage(
        settings.botToken,
        String(message.chat.id),
        "سلام! من ربات پنل مدیریت زمان‌بندی پیام هستم.\nبرای ثبت یک گروه/کانال، مرا ادمین کنید و دستور /id را در آن ارسال کنید.",
      );
    }
  }

  if (update.my_chat_member) {
    const status = update.my_chat_member.new_chat_member.status;
    const isActive = status === "member" || status === "administrator";
    await upsertChat(update.my_chat_member.chat, isActive);
  }

  return NextResponse.json({ ok: true });
}
