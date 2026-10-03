"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChatRow } from "@/components/admin/ChatsManager";

export type CampaignInitial = {
  id: number;
  name: string;
  messages: string[];
  chatIds: string[];
  intervalSeconds: number;
  isActive: boolean;
};

export default function CampaignForm({
  chats,
  initial,
  minIntervalSeconds,
}: {
  chats: ChatRow[];
  initial?: CampaignInitial;
  minIntervalSeconds: number;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const [name, setName] = useState(initial?.name ?? "");
  const [messages, setMessages] = useState<string[]>(initial?.messages ?? [""]);
  const [chatIds, setChatIds] = useState<string[]>(initial?.chatIds ?? []);
  const [intervalValue, setIntervalValue] = useState(initial?.intervalSeconds ?? 3600);
  const [intervalUnit, setIntervalUnit] = useState<"seconds" | "minutes" | "hours">("minutes");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleChat(chatId: string) {
    setChatIds((prev) => (prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId]));
  }

  function updateMessage(index: number, value: string) {
    setMessages((prev) => prev.map((m, i) => (i === index ? value : m)));
  }

  function addMessageField() {
    setMessages((prev) => [...prev, ""]);
  }

  function removeMessageField(index: number) {
    setMessages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanedMessages = messages.map((m) => m.trim()).filter(Boolean);
    if (cleanedMessages.length === 0) {
      setError("حداقل یک پیام الزامی است");
      return;
    }
    if (chatIds.length === 0) {
      setError("حداقل یک گروه را انتخاب کنید");
      return;
    }

    const multiplier = intervalUnit === "seconds" ? 1 : intervalUnit === "minutes" ? 60 : 3600;
    const intervalSeconds = intervalValue * multiplier;

    setLoading(true);
    try {
      const url = isEdit ? `/api/admin/campaigns/${initial!.id}` : "/api/admin/campaigns";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          messages: cleanedMessages,
          chatIds,
          intervalSeconds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "خطا در ذخیره کمپین");
        setLoading(false);
        return;
      }
      router.push("/admin/campaigns");
      router.refresh();
    } catch {
      setError("خطا در ارتباط با سرور");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <label className="mb-1.5 block text-sm font-medium text-slate-300">نام کمپین</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="مثلاً: تبلیغ محصول جدید"
          className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2.5 text-sm text-white outline-none ring-indigo-500 placeholder:text-slate-500 focus:ring-2"
        />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-3 flex items-center justify-between">
          <label className="block text-sm font-medium text-slate-300">
            پیام‌های چرخشی (هر بار نوبتی ارسال می‌شود)
          </label>
          <button
            type="button"
            onClick={addMessageField}
            className="rounded-lg bg-white/10 px-3 py-1 text-xs font-bold text-white hover:bg-white/20"
          >
            + افزودن پیام
          </button>
        </div>
        <div className="space-y-3">
          {messages.map((message, index) => (
            <div key={index} className="flex gap-2">
              <textarea
                value={message}
                onChange={(e) => updateMessage(index, e.target.value)}
                placeholder={`متن پیام شماره ${index + 1}`}
                rows={2}
                className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2.5 text-sm text-white outline-none ring-indigo-500 placeholder:text-slate-500 focus:ring-2"
              />
              {messages.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeMessageField(index)}
                  className="h-fit shrink-0 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20"
                >
                  حذف
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <label className="mb-1.5 block text-sm font-medium text-slate-300">فاصله زمانی بین ارسال‌ها</label>
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            value={intervalValue}
            onChange={(e) => setIntervalValue(Number(e.target.value))}
            className="w-32 rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2.5 text-sm text-white outline-none ring-indigo-500 focus:ring-2"
          />
          <select
            value={intervalUnit}
            onChange={(e) => setIntervalUnit(e.target.value as typeof intervalUnit)}
            className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2.5 text-sm text-white outline-none ring-indigo-500 focus:ring-2"
          >
            <option value="seconds">ثانیه</option>
            <option value="minutes">دقیقه</option>
            <option value="hours">ساعت</option>
          </select>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          حداقل مجاز: {minIntervalSeconds} ثانیه (قابل تغییر در صفحه تنظیمات)
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <label className="mb-3 block text-sm font-medium text-slate-300">انتخاب گروه‌های مقصد</label>
        {chats.length === 0 ? (
          <p className="text-sm text-slate-500">
            ابتدا از صفحه «گروه‌ها و کانال‌ها» حداقل یک گروه اضافه کنید.
          </p>
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

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-gradient-to-l from-indigo-500 to-fuchsia-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "در حال ذخیره..." : isEdit ? "ذخیره تغییرات" : "ایجاد کمپین"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/campaigns")}
          className="rounded-xl bg-white/10 px-6 py-2.5 text-sm font-bold text-white hover:bg-white/20"
        >
          انصراف
        </button>
      </div>
    </form>
  );
}
