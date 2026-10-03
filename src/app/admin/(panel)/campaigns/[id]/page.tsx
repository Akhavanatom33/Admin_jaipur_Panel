import { notFound } from "next/navigation";
import { db } from "@/db";
import { campaigns, chats } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getSettings } from "@/lib/settings";
import CampaignForm from "@/components/admin/CampaignForm";

export const dynamic = "force-dynamic";

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [campaignRows, chatRows, settings] = await Promise.all([
    db.select().from(campaigns).where(eq(campaigns.id, Number(id))).limit(1),
    db.select().from(chats).orderBy(desc(chats.addedAt)),
    getSettings(),
  ]);

  const campaign = campaignRows[0];
  if (!campaign) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">ویرایش کمپین</h1>
        <p className="mt-1 text-sm text-slate-400">{campaign.name}</p>
      </div>
      <CampaignForm
        chats={chatRows.map((row) => ({ ...row, addedAt: row.addedAt.toISOString() }))}
        minIntervalSeconds={settings.minIntervalSeconds}
        initial={{
          id: campaign.id,
          name: campaign.name,
          messages: campaign.messages,
          chatIds: campaign.chatIds,
          intervalSeconds: campaign.intervalSeconds,
          isActive: campaign.isActive,
        }}
      />
    </div>
  );
}
