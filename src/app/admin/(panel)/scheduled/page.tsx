import { db } from "@/db";
import { chats, scheduledPosts } from "@/db/schema";
import { desc } from "drizzle-orm";
import ScheduledManager from "@/components/admin/ScheduledManager";

export const dynamic = "force-dynamic";

export default async function ScheduledPage() {
  const [postRows, chatRows] = await Promise.all([
    db.select().from(scheduledPosts).orderBy(desc(scheduledPosts.scheduledAt)),
    db.select().from(chats).orderBy(desc(chats.addedAt)),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">پست‌های زمان‌بندی‌شده</h1>
        <p className="mt-1 text-sm text-slate-400">ارسال یک‌باره پیام در تاریخ و ساعت مشخص</p>
      </div>
      <ScheduledManager
        initial={postRows.map((row) => ({
          ...row,
          scheduledAt: row.scheduledAt.toISOString(),
          sentAt: row.sentAt ? row.sentAt.toISOString() : null,
        }))}
        chats={chatRows.map((row) => ({ ...row, addedAt: row.addedAt.toISOString() }))}
      />
    </div>
  );
}
