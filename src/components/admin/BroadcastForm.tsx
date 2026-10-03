"use client";

import { useState } from "react";
import type { ChatRow } from "@/components/admin/ChatsManager";

export default function BroadcastForm({ chats }: { chats: ChatRow[] }) {
  const [message, setMessage] = useState("");
  const [chatIds, setChatIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ chatId: string; ok: boolean; error?: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleChat(chatId: string) {
    setChatIds((prev) => (prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId]));
  }

  function toggleAll() {
    setChatIds(chatIds.length === chats.length ? [] : chats.map((c) => c.chatId));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (chatIds.length === 0) {
      setError("حداقل یک گروه را انتخاب کنید");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, chatIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "خطا در ارسال پیام");
      } else {
        setResult(data.results);
        setMessage("");
      }
    } catch {
      setError("خطا در ارتباط با سرور");
    } finally {
      setLoading(false);
    }
  }

  function chatTitle(chatId: string): string {
    return chats.find((c) => c.chatId === chatId)?.title ?? chatId;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <label className="mb-1.5 block text-sm font-medium text-slate-300">متن پیام</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={4}
          placeholder="پیام خود را بنویسید..."
          className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2.5 text-sm text-white outline-none ring-indigo-500 placeholder:text-slate-500 focus:ring-2"
        />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-3 flex items-center justify-between">
          <label className="text-sm font-medium text-slate-300">گروه‌های مقصد</label>
          {chats.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-bold text-indigo-300 hover:underline"
            >
              {chatIds.length === chats.length ? "لغو انتخاب همه" : "انتخاب همه"}
            </button>
          )}
        </div>
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

      {result && (
        <div className="space-y-1 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          {result.map((r) => (
            <p key={r.chatId} className={`text-sm ${r.ok ? "text-emerald-300" : "text-red-300"}`}>
              {r.ok ? "✅" : "❌"} {chatTitle(r.chatId)} {r.error ? `— ${r.error}` : ""}
            </p>
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-gradient-to-l from-indigo-500 to-fuchsia-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "در حال ارسال..." : "ارسال فوری"}
      </button>
    </form>
  );
}
