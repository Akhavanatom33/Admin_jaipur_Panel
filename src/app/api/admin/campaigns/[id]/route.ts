import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const rows = await db.select().from(campaigns).where(eq(campaigns.id, Number(id))).limit(1);
  if (!rows[0]) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
  return NextResponse.json(rows[0]);
}

const schema = z.object({
  name: z.string().trim().min(1).optional(),
  messages: z.array(z.string().trim().min(1)).min(1).optional(),
  chatIds: z.array(z.string()).min(1).optional(),
  intervalSeconds: z.coerce.number().int().min(10).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر" }, { status: 400 });
  }

  const settings = await getSettings();
  if (
    parsed.data.intervalSeconds !== undefined &&
    parsed.data.intervalSeconds < settings.minIntervalSeconds
  ) {
    return NextResponse.json(
      { error: `فاصله زمانی باید حداقل ${settings.minIntervalSeconds} ثانیه باشد` },
      { status: 400 },
    );
  }

  const existingRows = await db.select().from(campaigns).where(eq(campaigns.id, Number(id))).limit(1);
  const existing = existingRows[0];
  if (!existing) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });

  const patch: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };

  // Activating a previously inactive campaign should start its timer now.
  if (parsed.data.isActive === true && !existing.isActive) {
    patch.nextRunAt = new Date();
    patch.currentIndex = 0;
  }
  if (parsed.data.isActive === false) {
    patch.nextRunAt = null;
  }

  const [updated] = await db
    .update(campaigns)
    .set(patch)
    .where(eq(campaigns.id, Number(id)))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await db.delete(campaigns).where(eq(campaigns.id, Number(id)));
  return NextResponse.json({ ok: true });
}
