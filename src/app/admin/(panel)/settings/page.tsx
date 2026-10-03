import { getSettings } from "@/lib/settings";
import SettingsForm from "@/components/admin/SettingsForm";

export const dynamic = "force-dynamic";

function maskToken(token: string): string {
  if (token.length <= 10) return "••••••••";
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">تنظیمات</h1>
        <p className="mt-1 text-sm text-slate-400">تنظیمات ربات تلگرام، وبهوک و حساب مدیریتی</p>
      </div>
      <SettingsForm
        initial={{
          botToken: settings.botToken ? maskToken(settings.botToken) : null,
          botUsername: settings.botUsername,
          minIntervalSeconds: settings.minIntervalSeconds,
          schedulerTickSeconds: settings.schedulerTickSeconds,
          webhookSecret: settings.webhookSecret,
        }}
      />
    </div>
  );
}
