import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { logs } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitParam) || 100, 1), 500);
  const rows = await db.select().from(logs).orderBy(desc(logs.createdAt)).limit(limit);
  return NextResponse.json(rows);
}
