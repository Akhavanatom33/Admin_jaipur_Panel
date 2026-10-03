import { db } from "@/db";
import { chats } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getSettings } from "@/lib/settings";
import CampaignForm from "@/components/admin/CampaignForm";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const [chatRows, settings] = await Promise.all([
    db.select().from(chats).where(eq(chats.isActive, true)).orderBy(desc(chats.addedAt)),
    getSettings(),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">ایجاد کمپین جدید</h1>
        <p className="mt-1 text-sm text-slate-400">یک یا چند پیام چرخشی را زمان‌بندی کنید</p>
      </div>
      <CampaignForm
        chats={chatRows.map((row) => ({ ...row, addedAt: row.addedAt.toISOString() }))}
        minIntervalSeconds={settings.minIntervalSeconds}
      />
    </div>
  );
}
