"use client";

import { useState } from "react";

type SettingsData = {
  botToken: string | null;
  botUsername: string | null;
  minIntervalSeconds: number;
  schedulerTickSeconds: number;
  webhookSecret: string | null;
};

export default function SettingsForm({ initial }: { initial: SettingsData }) {
  const [botToken, setBotToken] = useState("");
  const [minInterval, setMinInterval] = useState(initial.minIntervalSeconds);
  const [tickSeconds, setTickSeconds] = useState(initial.schedulerTickSeconds);
  const [botUsername, setBotUsername] = useState(initial.botUsername);
  const [maskedToken, setMaskedToken] = useState(initial.botToken);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookMsg, setWebhookMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken: botToken || undefined,
          minIntervalSeconds: minInterval,
          schedulerTickSeconds: tickSeconds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSettingsMsg({ type: "err", text: data.error ?? "خطا در ذخیره تنظیمات" });
      } else {
        setSettingsMsg({ type: "ok", text: "تنظیمات با موفقیت ذخیره شد" });
        setBotUsername(data.botUsername);
        setMaskedToken(data.botToken);
        setBotToken("");
      }
    } catch {
      setSettingsMsg({ type: "err", text: "خطا در ارتباط با سرور" });
    } finally {
      setSavingSettings(false);
    }
  }

  async function registerWebhook() {
    setWebhookLoading(true);
    setWebhookMsg(null);
    try {
      const res = await fetch("/api/admin/settings/webhook", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setWebhookMsg({ type: "err", text: data.error ?? "خطا در ثبت وبهوک" });
      } else {
        setWebhookUrl(data.url);
        setWebhookMsg({ type: "ok", text: "وبهوک با موفقیت ثبت شد" });
      }
    } catch {
      setWebhookMsg({ type: "err", text: "خطا در ارتباط با سرور" });
    } finally {
      setWebhookLoading(false);
    }
  }

  async function removeWebhook() {
    setWebhookLoading(true);
    setWebhookMsg(null);
    try {
      const res = await fetch("/api/admin/settings/webhook", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setWebhookMsg({ type: "err", text: data.error ?? "خطا در حذف وبهوک" });
      } else {
        setWebhookUrl(null);
        setWebhookMsg({ type: "ok", text: "وبهوک حذف شد" });
      }
    } catch {
      setWebhookMsg({ type: "err", text: "خطا در ارتباط با سرور" });
    } finally {
      setWebhookLoading(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwLoading(true);
    setPwMsg(null);
    try {
      const res = await fetch("/api/admin/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwMsg({ type: "err", text: data.error ?? "خطا در تغییر رمز عبور" });
      } else {
        setPwMsg({ type: "ok", text: "رمز عبور با موفقیت تغییر کرد" });
        setCurrentPassword("");
        setNewPassword("");
      }
    } catch {
      setPwMsg({ type: "err", text: "خطا در ارتباط با سرور" });
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={saveSettings} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="mb-4 text-lg font-bold text-white">تنظیمات ربات تلگرام</h2>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">
              توکن ربات (BotFather) {maskedToken && <span className="text-xs text-emerald-400">— فعلی: {maskedToken}</span>}
            </label>
            <input
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
              className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2.5 text-sm text-white outline-none ring-indigo-500 placeholder:text-slate-500 focus:ring-2"
              dir="ltr"
            />
            {botUsername && <p className="mt-1 text-xs text-slate-500">متصل به: @{botUsername}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">
                حداقل فاصله مجاز بین ارسال‌ها (ثانیه)
              </label>
              <input
                type="number"
                min={5}
                value={minInterval}
                onChange={(e) => setMinInterval(Number(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2.5 text-sm text-white outline-none ring-indigo-500 focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">
                فاصله بررسی زمان‌بند (ثانیه)
              </label>
              <input
                type="number"
                min={5}
                value={tickSeconds}
                onChange={(e) => setTickSeconds(Number(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2.5 text-sm text-white outline-none ring-indigo-500 focus:ring-2"
              />
            </div>
          </div>

          {settingsMsg && (
            <div
              className={`rounded-xl px-4 py-2.5 text-sm ${
                settingsMsg.type === "ok"
                  ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border border-red-500/30 bg-red-500/10 text-red-300"
              }`}
            >
              {settingsMsg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={savingSettings}
            className="rounded-xl bg-gradient-to-l from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
          >
            {savingSettings ? "در حال ذخیره..." : "ذخیره تنظیمات"}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="mb-2 text-lg font-bold text-white">اتصال وبهوک تلگرام</h2>
        <p className="mb-4 text-sm text-slate-400">
          با فعال‌سازی وبهوک، دستور <code dir="ltr">/id</code> در گروه‌ها به‌صورت خودکار چت را ثبت می‌کند و افزودن
          ربات به گروه‌ها نیز خودکار شناسایی می‌شود.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={registerWebhook}
            disabled={webhookLoading}
            className="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/30 disabled:opacity-50"
          >
            {webhookLoading ? "در حال انجام..." : "فعال‌سازی / تمدید وبهوک"}
          </button>
          <button
            onClick={removeWebhook}
            disabled={webhookLoading}
            className="rounded-xl bg-red-500/20 px-4 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/30 disabled:opacity-50"
          >
            حذف وبهوک
          </button>
        </div>
        {webhookUrl && (
          <p className="mt-3 break-all rounded-xl bg-slate-900/70 p-3 text-xs text-slate-400" dir="ltr">
            {webhookUrl}
          </p>
        )}
        {webhookMsg && (
          <div
            className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${
              webhookMsg.type === "ok"
                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border border-red-500/30 bg-red-500/10 text-red-300"
            }`}
          >
            {webhookMsg.text}
          </div>
        )}
      </div>

      <form onSubmit={changePassword} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="mb-4 text-lg font-bold text-white">تغییر رمز عبور حساب مدیر</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">رمز عبور فعلی</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2.5 text-sm text-white outline-none ring-indigo-500 focus:ring-2"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">رمز عبور جدید</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2.5 text-sm text-white outline-none ring-indigo-500 focus:ring-2"
            />
          </div>
        </div>
        {pwMsg && (
          <div
            className={`mt-4 rounded-xl px-4 py-2.5 text-sm ${
              pwMsg.type === "ok"
                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border border-red-500/30 bg-red-500/10 text-red-300"
            }`}
          >
            {pwMsg.text}
          </div>
        )}
        <button
          type="submit"
          disabled={pwLoading}
          className="mt-4 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/20 disabled:opacity-50"
        >
          {pwLoading ? "در حال ذخیره..." : "تغییر رمز عبور"}
        </button>
      </form>
    </div>
  );
}
