"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "داشبورد", icon: "📊", exact: true },
  { href: "/admin/campaigns", label: "کمپین‌ها", icon: "🔁" },
  { href: "/admin/scheduled", label: "پست‌های زمان‌بندی‌شده", icon: "⏰" },
  { href: "/admin/broadcast", label: "ارسال فوری", icon: "📣" },
  { href: "/admin/chats", label: "گروه‌ها و کانال‌ها", icon: "💬" },
  { href: "/admin/logs", label: "گزارش ارسال‌ها", icon: "🧾" },
  { href: "/admin/settings", label: "تنظیمات", icon: "⚙️" },
];

export default function AdminShell({
  username,
  children,
}: {
  username: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside className="hidden w-64 shrink-0 flex-col border-l border-white/10 bg-slate-900/60 p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-xl">
            🛰️
          </div>
          <div>
            <p className="text-sm font-bold text-white">پنل جی‌پور</p>
            <p className="text-xs text-slate-400">مدیریت ربات تلگرام</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-gradient-to-l from-indigo-500/90 to-fuchsia-500/90 text-white shadow-lg"
                    : "text-slate-300 hover:bg-white/5"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="truncate text-xs text-slate-400">کاربر وارد شده</p>
          <p className="truncate text-sm font-bold text-white">{username}</p>
          <button
            onClick={handleLogout}
            className="mt-3 w-full rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-300 transition hover:bg-red-500/20"
          >
            خروج از حساب
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-white/10 bg-slate-900/40 px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-base">
              🛰️
            </div>
            <p className="text-sm font-bold text-white">پنل جی‌پور</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300"
          >
            خروج
          </button>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-white/10 bg-slate-900/30 px-2 py-2 md:hidden">
          {NAV_ITEMS.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  active ? "bg-indigo-500 text-white" : "bg-white/5 text-slate-300"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
