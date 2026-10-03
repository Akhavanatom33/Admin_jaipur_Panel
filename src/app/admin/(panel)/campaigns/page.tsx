import Link from "next/link";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { desc } from "drizzle-orm";
import CampaignsList from "@/components/admin/CampaignsList";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const rows = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">کمپین‌ها</h1>
          <p className="mt-1 text-sm text-slate-400">پیام‌های تکرارشونده و چرخشی برای گروه‌های شما</p>
        </div>
        <Link
          href="/admin/campaigns/new"
          className="rounded-xl bg-gradient-to-l from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:opacity-90"
        >
          + کمپین جدید
        </Link>
      </div>
      <CampaignsList
        initial={rows.map((row) => ({
          ...row,
          lastRunAt: row.lastRunAt ? row.lastRunAt.toISOString() : null,
          nextRunAt: row.nextRunAt ? row.nextRunAt.toISOString() : null,
        }))}
      />
    </div>
  );
}
