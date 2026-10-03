"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type CampaignRow = {
  id: number;
  name: string;
  messages: string[];
  chatIds: string[];
  intervalSeconds: number;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
};

function formatInterval(seconds: number): string {
  if (seconds % 3600 === 0) return `${seconds / 3600} ساعت`;
  if (seconds % 60 === 0) return `${seconds / 60} دقیقه`;
  return `${seconds} ثانیه`;
}

export default function CampaignsList({ initial }: { initial: CampaignRow[] }) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState(initial);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function toggleActive(id: number, isActive: boolean) {
    setBusyId(id);
    const res = await fetch(`/api/admin/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    if (res.ok) {
      const updated = await res.json();
      setCampaigns((prev) => prev.map((c) => (c.id === id ? updated : c)));
    }
    setBusyId(null);
  }

  async function removeCampaign(id: number) {
    if (!confirm("آیا از حذف این کمپین مطمئن هستید؟")) return;
    setBusyId(id);
    const res = await fetch(`/api/admin/campaigns/${id}`, { method: "DELETE" });
    if (res.ok) {
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      router.refresh();
    }
    setBusyId(null);
  }

  if (campaigns.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
        <p className="text-sm text-slate-500">هنوز کمپینی ایجاد نشده است.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {campaigns.map((campaign) => (
        <div key={campaign.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h3 className="text-base font-bold text-white">{campaign.name}</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {campaign.messages.length} پیام چرخشی · {campaign.chatIds.length} گروه مقصد
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                campaign.isActive ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-500/20 text-slate-400"
              }`}
            >
              {campaign.isActive ? "در حال اجرا" : "متوقف"}
            </span>
          </div>

          <div className="mb-4 space-y-1 text-xs text-slate-500">
            <p>⏱ فاصله ارسال: {formatInterval(campaign.intervalSeconds)}</p>
            {campaign.lastRunAt && <p>🕑 آخرین ارسال: {new Date(campaign.lastRunAt).toLocaleString("fa-IR")}</p>}
            {campaign.isActive && campaign.nextRunAt && (
              <p>⏭ ارسال بعدی: {new Date(campaign.nextRunAt).toLocaleString("fa-IR")}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => toggleActive(campaign.id, campaign.isActive)}
              disabled={busyId === campaign.id}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
                campaign.isActive
                  ? "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                  : "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
              }`}
            >
              {campaign.isActive ? "توقف" : "شروع"}
            </button>
            <Link
              href={`/admin/campaigns/${campaign.id}`}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20"
            >
              ویرایش
            </Link>
            <button
              onClick={() => removeCampaign(campaign.id)}
              disabled={busyId === campaign.id}
              className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
            >
              حذف
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
