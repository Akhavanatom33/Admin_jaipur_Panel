import { db } from "@/db";
import { chats } from "@/db/schema";
import { desc } from "drizzle-orm";
import ChatsManager from "@/components/admin/ChatsManager";

export const dynamic = "force-dynamic";

export default async function ChatsPage() {
  const rows = await db.select().from(chats).orderBy(desc(chats.addedAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">گروه‌ها و کانال‌ها</h1>
        <p className="mt-1 text-sm text-slate-400">مدیریت گروه‌ها و کانال‌های مقصد برای ارسال پیام</p>
      </div>
      <ChatsManager
        initial={rows.map((row) => ({ ...row, addedAt: row.addedAt.toISOString() }))}
      />
    </div>
  );
}
