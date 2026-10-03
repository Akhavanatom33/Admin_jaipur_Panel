"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type ChatRow = {
  id: number;
  chatId: string;
  title: string;
  type: string;
  isActive: boolean;
  addedAt: string;
};

export default function ChatsManager({ initial }: { initial: ChatRow[] }) {
  const router = useRouter();
  const [chats, setChats] = useState(initial);
  const [chatId, setChatId] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addChat(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, title: title || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "خطا در افزودن گروه");
      } else {
        setChats((prev) => [data, ...prev]);
        setChatId("");
        setTitle("");
      }
    } catch {
      setError("خطا در ارتباط با سرور");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(id: number, isActive: boolean) {
    const res = await fetch(`/api/admin/chats/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    if (res.ok) {
      const updated = await res.json();
      setChats((prev) => prev.map((c) => (c.id === id ? updated : c)));
    }
  }

  async function removeChat(id: number) {
    if (!confirm("آیا از حذف این گروه مطمئن هستید؟")) return;
    const res = await fetch(`/api/admin/chats/${id}`, { method: "DELETE" });
    if (res.ok) {
      setChats((prev) => prev.filter((c) => c.id !== id));
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={addChat} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="mb-4 text-lg font-bold text-white">افزودن گروه/کانال جدید</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_2fr_auto]">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">شناسه چت (Chat ID)</label>
            <input
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="-1001234567890"
              required
              dir="ltr"
              className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2.5 text-sm text-white outline-none ring-indigo-500 placeholder:text-slate-500 focus:ring-2"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">عنوان (اختیاری)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="نام گروه"
              className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2.5 text-sm text-white outline-none ring-indigo-500 placeholder:text-slate-500 focus:ring-2"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-l from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50 sm:w-auto"
            >
              {loading ? "..." : "افزودن"}
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          راهکار دیگر: ربات را به گروه اضافه و ادمین کنید، سپس دستور <code dir="ltr">/id</code> را در آن ارسال
          کنید تا به‌صورت خودکار ثبت شود (نیازمند فعال‌سازی وبهوک در صفحه تنظیمات).
        </p>
        {error && (
          <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
            {error}
          </div>
        )}
      </form>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="mb-4 text-lg font-bold text-white">گروه‌های ثبت‌شده ({chats.length})</h2>
        {chats.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">هنوز گروهی ثبت نشده است.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="text-xs text-slate-400">
                  <th className="pb-2 font-medium">عنوان</th>
                  <th className="pb-2 font-medium">شناسه</th>
                  <th className="pb-2 font-medium">نوع</th>
                  <th className="pb-2 font-medium">وضعیت</th>
                  <th className="pb-2 font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {chats.map((chat) => (
                  <tr key={chat.id}>
                    <td className="py-2.5 font-medium text-white">{chat.title}</td>
                    <td className="py-2.5 text-slate-400" dir="ltr">
                      {chat.chatId}
                    </td>
                    <td className="py-2.5 text-slate-400">{chat.type}</td>
                    <td className="py-2.5">
                      <button
                        onClick={() => toggleActive(chat.id, chat.isActive)}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          chat.isActive
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-slate-500/20 text-slate-400"
                        }`}
                      >
                        {chat.isActive ? "فعال" : "غیرفعال"}
                      </button>
                    </td>
                    <td className="py-2.5">
                      <button
                        onClick={() => removeChat(chat.id)}
                        className="rounded-lg bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300 hover:bg-red-500/20"
                      >
                        حذف
                      </button>
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
