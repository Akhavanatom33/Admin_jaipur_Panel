import Link from "next/link";
import { db } from "@/db";
import { campaigns, chats, logs, scheduledPosts } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-lg ${accent}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{label}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const [chatCountRows, activeChatRows, campaignRows, activeCampaignRows, pendingPostRows, recentLogs, settings] =
    await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(chats),
      db.select({ count: sql<number>`count(*)` }).from(chats).where(eq(chats.isActive, true)),
      db.select({ count: sql<number>`count(*)` }).from(campaigns),
      db.select({ count: sql<number>`count(*)` }).from(campaigns).where(eq(campaigns.isActive, true)),
      db.select({ count: sql<number>`count(*)` }).from(scheduledPosts).where(eq(scheduledPosts.status, "pending")),
      db.select().from(logs).orderBy(desc(logs.createdAt)).limit(8),
      getSettings(),
    ]);

  const chatCount = Number(chatCountRows[0]?.count ?? 0);
  const activeChatCount = Number(activeChatRows[0]?.count ?? 0);
  const campaignCount = Number(campaignRows[0]?.count ?? 0);
  const activeCampaignCount = Number(activeCampaignRows[0]?.count ?? 0);
  const pendingPostCount = Number(pendingPostRows[0]?.count ?? 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">داشبورد</h1>
        <p className="mt-1 text-sm text-slate-400">نمای کلی از وضعیت ربات و فعالیت‌های پنل</p>
      </div>

      {!settings.botToken && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          توکن ربات تنظیم نشده است. برای شروع به{" "}
          <Link href="/admin/settings" className="font-bold underline">
            صفحه تنظیمات
          </Link>{" "}
          بروید.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="💬" label="گروه‌های فعال" value={`${activeChatCount} / ${chatCount}`} accent="bg-sky-500/20 text-sky-300" />
        <StatCard icon="🔁" label="کمپین‌های فعال" value={`${activeCampaignCount} / ${campaignCount}`} accent="bg-fuchsia-500/20 text-fuchsia-300" />
        <StatCard icon="⏰" label="پست‌های در انتظار" value={pendingPostCount} accent="bg-amber-500/20 text-amber-300" />
        <StatCard
          icon={settings.botToken ? "✅" : "⚠️"}
          label={settings.botToken ? `ربات: @${settings.botUsername ?? "متصل"}` : "ربات متصل نیست"}
          value={settings.botToken ? "آنلاین" : "غیرفعال"}
          accent={settings.botToken ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}
        />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">آخرین فعالیت‌ها</h2>
          <Link href="/admin/logs" className="text-xs font-bold text-indigo-300 hover:underline">
            مشاهده همه
          </Link>
        </div>
        {recentLogs.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">هنوز فعالیتی ثبت نشده است.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="text-xs text-slate-400">
                  <th className="pb-2 font-medium">منبع</th>
                  <th className="pb-2 font-medium">گروه</th>
                  <th className="pb-2 font-medium">پیام</th>
                  <th className="pb-2 font-medium">وضعیت</th>
                  <th className="pb-2 font-medium">زمان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2 text-slate-300">{sourceLabel(log.source)}</td>
                    <td className="py-2 text-slate-400">{log.chatTitle || log.chatId}</td>
                    <td className="max-w-xs truncate py-2 text-slate-400">{log.messagePreview}</td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          log.status === "success"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-red-500/20 text-red-300"
                        }`}
                      >
                        {log.status === "success" ? "موفق" : "ناموفق"}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-slate-500">
                      {new Date(log.createdAt).toLocaleString("fa-IR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function sourceLabel(source: string) {
  switch (source) {
    case "campaign":
      return "کمپین";
    case "scheduled":
      return "زمان‌بندی‌شده";
    case "broadcast":
      return "ارسال فوری";
    default:
      return source;
  }
}
