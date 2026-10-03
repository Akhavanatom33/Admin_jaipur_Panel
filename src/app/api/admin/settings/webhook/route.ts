import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/settings";
import {
  deleteTelegramWebhook,
  getTelegramWebhookInfo,
  setTelegramWebhook,
} from "@/lib/telegram";

export const dynamic = "force-dynamic";

function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function resolveOrigin(req: NextRequest): string {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedHost) {
    return `${forwardedProto ?? "https"}://${forwardedHost}`;
  }
  return req.nextUrl.origin;
}

export async function GET(req: NextRequest) {
  const settings = await getSettings();
  if (!settings.botToken) {
    return NextResponse.json({ error: "ابتدا توکن ربات را تنظیم کنید" }, { status: 400 });
  }
  const info = await getTelegramWebhookInfo(settings.botToken);
  if (!info.ok) {
    return NextResponse.json({ error: info.error }, { status: 400 });
  }
  return NextResponse.json({ info: info.result, webhookSecret: settings.webhookSecret });
}

export async function POST(req: NextRequest) {
  const settings = await getSettings();
  if (!settings.botToken) {
    return NextResponse.json({ error: "ابتدا توکن ربات را تنظیم کنید" }, { status: 400 });
  }

  const webhookSecret = settings.webhookSecret || randomSecret();
  const origin = resolveOrigin(req);
  const url = `${origin}/api/telegram/webhook/${webhookSecret}`;

  const result = await setTelegramWebhook(settings.botToken, url);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await updateSettings({ webhookSecret });
  return NextResponse.json({ ok: true, url });
}

export async function DELETE() {
  const settings = await getSettings();
  if (!settings.botToken) {
    return NextResponse.json({ error: "ابتدا توکن ربات را تنظیم کنید" }, { status: 400 });
  }
  const result = await deleteTelegramWebhook(settings.botToken);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
