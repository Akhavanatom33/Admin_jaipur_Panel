import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export type AppSettings = typeof settings.$inferSelect;

/** Returns the single settings row, creating it with defaults if missing. */
export async function getSettings(): Promise<AppSettings> {
  const rows = await db.select().from(settings).limit(1);
  if (rows[0]) return rows[0];

  const [created] = await db
    .insert(settings)
    .values({})
    .returning();
  return created;
}

export async function updateSettings(
  patch: Partial<Omit<AppSettings, "id" | "updatedAt">>,
): Promise<AppSettings> {
  const current = await getSettings();
  const [updated] = await db
    .update(settings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(settings.id, current.id))
    .returning();
  return updated;
}
