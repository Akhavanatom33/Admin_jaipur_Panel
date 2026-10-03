import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSettings, updateSettings } from "@/lib/settings";
import { getTelegramMe } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({
    ...settings,
    botTokenSet: Boolean(settings.botToken),
    botToken: settings.botToken ? maskToken(settings.botToken) : null,
  });
}

function maskToken(token: string): string {
  if (token.length <= 10) return "••••••••";
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

const schema = z.object({
  botToken: z.string().trim().optional(),
  minIntervalSeconds: z.coerce.number().int().min(5).max(86400).optional(),
  schedulerTickSeconds: z.coerce.number().int().min(5).max(300).optional(),
});

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (parsed.data.botToken !== undefined && parsed.data.botToken !== "") {
    const me = await getTelegramMe(parsed.data.botToken);
    if (!me.ok) {
      return NextResponse.json({ error: `توکن نامعتبر است: ${me.error}` }, { status: 400 });
    }
    patch.botToken = parsed.data.botToken;
    patch.botUsername = me.result.username ?? null;
  }

  if (parsed.data.minIntervalSeconds !== undefined) {
    patch.minIntervalSeconds = parsed.data.minIntervalSeconds;
  }
  if (parsed.data.schedulerTickSeconds !== undefined) {
    patch.schedulerTickSeconds = parsed.data.schedulerTickSeconds;
  }

  const updated = await updateSettings(patch);
  return NextResponse.json({
    ...updated,
    botTokenSet: Boolean(updated.botToken),
    botToken: updated.botToken ? maskToken(updated.botToken) : null,
  });
}
