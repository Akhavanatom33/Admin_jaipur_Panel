import { db } from "@/db";
import { chats } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import BroadcastForm from "@/components/admin/BroadcastForm";

export const dynamic = "force-dynamic";

export default async function BroadcastPage() {
  const rows = await db.select().from(chats).where(eq(chats.isActive, true)).orderBy(desc(chats.addedAt));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">ارسال فوری</h1>
        <p className="mt-1 text-sm text-slate-400">ارسال یک پیام همین حالا به یک یا چند گروه</p>
      </div>
      <BroadcastForm chats={rows.map((row) => ({ ...row, addedAt: row.addedAt.toISOString() }))} />
    </div>
  );
}
