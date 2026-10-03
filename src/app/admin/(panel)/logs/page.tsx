import { db } from "@/db";
import { logs } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

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

export default async function LogsPage() {
  const rows = await db.select().from(logs).orderBy(desc(logs.createdAt)).limit(300);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">گزارش ارسال‌ها</h1>
        <p className="mt-1 text-sm text-slate-400">تاریخچه کامل پیام‌های ارسال‌شده و نتیجه آن‌ها</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">هنوز گزارشی ثبت نشده است.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="text-xs text-slate-400">
                  <th className="pb-2 font-medium">منبع</th>
                  <th className="pb-2 font-medium">گروه</th>
                  <th className="pb-2 font-medium">پیام</th>
                  <th className="pb-2 font-medium">وضعیت</th>
                  <th className="pb-2 font-medium">خطا</th>
                  <th className="pb-2 font-medium">زمان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((log) => (
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
                    <td className="max-w-xs truncate py-2 text-xs text-red-400">{log.error || "—"}</td>
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
