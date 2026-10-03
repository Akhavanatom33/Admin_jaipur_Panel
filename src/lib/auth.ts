import { cookies } from "next/headers";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

export type CurrentAdmin = { id: number; username: string };

/** Reads the session cookie (Server Components / Route Handlers) and resolves the admin. */
export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);
  if (!session) return null;

  const rows = await db
    .select({ id: admins.id, username: admins.username })
    .from(admins)
    .where(eq(admins.id, session.adminId))
    .limit(1);

  return rows[0] ?? null;
}

export async function anyAdminExists(): Promise<boolean> {
  const rows = await db.select({ id: admins.id }).from(admins).limit(1);
  return rows.length > 0;
}
