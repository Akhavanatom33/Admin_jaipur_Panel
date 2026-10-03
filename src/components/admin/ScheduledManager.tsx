"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChatRow } from "@/components/admin/ChatsManager";

export type ScheduledRow = {
  id: number;
  message: string;
  chatIds: string[];
  scheduledAt: string;
  status: string;
  sentAt: string | null;
  error: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "در انتظار",
  sent: "ارسال‌شده",
  partial: "ارسال ناقص",
  failed: "ناموفق",
  cancelled: "لغوشده",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-300",
  sent: "bg-emerald-500/20 text-emerald-300",
  partial: "bg-amber-500/20 text-amber-300",
  failed: "bg-red-500/20 text-red-300",
  cancelled: "bg-slate-500/20 text-slate-400",
};

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

export default function ScheduledManager({
  initial,
  chats,
}: {
  initial: ScheduledRow[];
  chats: ChatRow[];
}) {
  const router = useRouter();
  const [posts, setPosts] = useState(initial);
  const [message, setMessage] = useState("");
  const [chatIds, setChatIds] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date(Date.now() + 10 * 60 * 1000);
    return toLocalInputValue(d);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleChat(chatId: string) {
    setChatIds((prev) => (prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId]));
  }

  async function createPost(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (chatIds.length === 0) {
      setError("حداقل یک گروه را انتخاب کنید");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          chatIds,
          scheduledAt: new Date(scheduledAt).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "خطا در ثبت پست زمان‌بندی‌شده");
      } else {
        setPosts((prev) => [data, ...prev]);
        setMessage("");
        setChatIds([]);
        router.refresh();
      }
    } catch {
      setError("خطا در ارتباط با سرور");
    } finally {
      setLoading(false);
    }
  }

  async function cancelPost(id: number) {
    const res = await fetch(`/api/admin/scheduled/${id}`, { method: "PATCH" });
    if (res.ok) {
      const updated = await res.json();
      setPosts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    }
  }

  async function deletePost(id: number) {
    if (!confirm("آیا از حذف این پست مطمئن هستید؟")) return;
    const res = await fetch(`/api/admin/scheduled/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPosts((prev) => prev.filter((p) => p.id !== id));
    }
  }

  function chatTitle(chatId: string): string {
    return chats.find((c) => c.chatId === chatId)?.title ?? chatId;
  }

  return (
    <div className="space-y-6">
      <form onSubmit={createPost} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="mb-4 text-lg font-bold text-white">زمان‌بندی پست تک‌باره</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">متن پیام</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2.5 text-sm text-white outline-none ring-indigo-500 focus:ring-2"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">زمان ارسال</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
              className="w-full max-w-xs rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2.5 text-sm text-white outline-none ring-indigo-500 focus:ring-2 sm:w-auto"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">گروه‌های مقصد</label>
            {chats.length === 0 ? (
              <p className="text-sm text-slate-500">ابتدا یک گروه اضافه کنید.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {chats.map((chat) => (
                  <label
                    key={chat.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                      chatIds.includes(chat.chatId)
                        ? "border-indigo-500/50 bg-indigo-500/10 text-white"
                        : "border-white/10 bg-slate-900/40 text-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={chatIds.includes(chat.chatId)}
                      onChange={() => toggleChat(chat.chatId)}
                      className="accent-indigo-500"
                    />
                    <span className="truncate">{chat.title}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-gradient-to-l from-indigo-500 to-fuchsia-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "در حال ثبت..." : "زمان‌بندی کن"}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="mb-4 text-lg font-bold text-white">پست‌های زمان‌بندی‌شده ({posts.length})</h2>
        {posts.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">هنوز پستی زمان‌بندی نشده است.</p>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div key={post.id} className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
                <div className="mb-2 flex items-start justify-between gap-4">
                  <p className="text-sm text-white">{post.message}</p>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_COLOR[post.status]}`}>
                    {STATUS_LABEL[post.status] ?? post.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  🎯 {post.chatIds.map(chatTitle).join("، ")} · 🗓 {new Date(post.scheduledAt).toLocaleString("fa-IR")}
                </p>
                {post.error && <p className="mt-1 text-xs text-red-400">خطا: {post.error}</p>}
                {post.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => cancelPost(post.id)}
                      className="rounded-lg bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-300 hover:bg-amber-500/25"
                    >
                      لغو
                    </button>
                    <button
                      onClick={() => deletePost(post.id)}
                      className="rounded-lg bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300 hover:bg-red-500/20"
                    >
                      حذف
                    </button>
                  </div>
                )}
                {post.status !== "pending" && (
                  <div className="mt-3">
                    <button
                      onClick={() => deletePost(post.id)}
                      className="rounded-lg bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300 hover:bg-red-500/20"
                    >
                      حذف
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
