import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { chats } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().trim().min(1).optional(),
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
    return NextResponse.json({ error: "ورودی نامعتبر" }, { status: 400 });
  }

  const [updated] = await db
    .update(chats)
    .set(parsed.data)
    .where(eq(chats.id, Number(id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await db.delete(chats).where(eq(chats.id, Number(id)));
  return NextResponse.json({ ok: true });
}
