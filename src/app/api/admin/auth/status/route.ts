import { NextResponse } from "next/server";
import { anyAdminExists, getCurrentAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const [hasAdmin, admin] = await Promise.all([anyAdminExists(), getCurrentAdmin()]);
  return NextResponse.json({ setupRequired: !hasAdmin, admin });
}
