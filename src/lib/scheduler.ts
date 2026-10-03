import { db } from "@/db";
import { campaigns, logs, scheduledPosts } from "@/db/schema";
import { and, eq, lte } from "drizzle-orm";
import { getSettings } from "@/lib/settings";
import { sendTelegramMessage } from "@/lib/telegram";

let isTicking = false;

async function recordLog(entry: {
  source: "campaign" | "scheduled" | "broadcast" | "webhook";
  refId?: number | null;
  chatId: string;
  chatTitle?: string | null;
  messagePreview: string;
  status: "success" | "failed";
  error?: string | null;
}) {
  await db.insert(logs).values({
    source: entry.source,
    refId: entry.refId ?? null,
    chatId: entry.chatId,
    chatTitle: entry.chatTitle ?? null,
    messagePreview: entry.messagePreview.slice(0, 500),
    status: entry.status,
    error: entry.error ?? null,
  });
}

async function processScheduledPosts(botToken: string) {
  const due = await db
    .select()
    .from(scheduledPosts)
    .where(and(eq(scheduledPosts.status, "pending"), lte(scheduledPosts.scheduledAt, new Date())));

  for (const post of due) {
    let successCount = 0;
    let lastError = "";
    for (const chatId of post.chatIds) {
      const result = await sendTelegramMessage(botToken, chatId, post.message);
      if (result.ok) {
        successCount += 1;
        await recordLog({
          source: "scheduled",
          refId: post.id,
          chatId,
          messagePreview: post.message,
          status: "success",
        });
      } else {
        lastError = result.error;
        await recordLog({
          source: "scheduled",
          refId: post.id,
          chatId,
          messagePreview: post.message,
          status: "failed",
          error: result.error,
        });
      }
    }

    const finalStatus =
      successCount === post.chatIds.length
        ? "sent"
        : successCount > 0
          ? "partial"
          : "failed";

    await db
      .update(scheduledPosts)
      .set({
        status: finalStatus,
        sentAt: new Date(),
        error: finalStatus === "sent" ? null : lastError || null,
      })
      .where(eq(scheduledPosts.id, post.id));
  }
}

async function processCampaigns(botToken: string) {
  const due = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.isActive, true), lte(campaigns.nextRunAt, new Date())));

  for (const campaign of due) {
    if (!campaign.messages.length || !campaign.chatIds.length) {
      await db
        .update(campaigns)
        .set({ nextRunAt: new Date(Date.now() + campaign.intervalSeconds * 1000) })
        .where(eq(campaigns.id, campaign.id));
      continue;
    }

    const message = campaign.messages[campaign.currentIndex % campaign.messages.length];

    for (const chatId of campaign.chatIds) {
      const result = await sendTelegramMessage(botToken, chatId, message);
      await recordLog({
        source: "campaign",
        refId: campaign.id,
        chatId,
        messagePreview: message,
        status: result.ok ? "success" : "failed",
        error: result.ok ? null : result.error,
      });
    }

    await db
      .update(campaigns)
      .set({
        currentIndex: (campaign.currentIndex + 1) % campaign.messages.length,
        lastRunAt: new Date(),
        nextRunAt: new Date(Date.now() + campaign.intervalSeconds * 1000),
      })
      .where(eq(campaigns.id, campaign.id));
  }
}

export async function runSchedulerTick() {
  if (isTicking) return;
  isTicking = true;
  try {
    const settings = await getSettings();
    if (!settings.botToken) return;
    await processScheduledPosts(settings.botToken);
    await processCampaigns(settings.botToken);
  } catch (err) {
    console.error("[scheduler] tick failed:", err);
  } finally {
    isTicking = false;
  }
}

const globalForScheduler = globalThis as typeof globalThis & {
  __jaipurSchedulerStarted?: boolean;
};

async function scheduleNextTick() {
  await runSchedulerTick();
  let tickSeconds = 15;
  try {
    const settings = await getSettings();
    tickSeconds = Math.max(5, settings.schedulerTickSeconds || 15);
  } catch (err) {
    console.error("[scheduler] failed to read settings:", err);
  }
  setTimeout(() => void scheduleNextTick(), tickSeconds * 1000);
}

export function startScheduler() {
  if (globalForScheduler.__jaipurSchedulerStarted) return;
  globalForScheduler.__jaipurSchedulerStarted = true;

  console.log("[scheduler] started");
  setTimeout(() => void scheduleNextTick(), 3000);
}
