// Minimal Telegram Bot API client used by the admin panel.

export type TelegramResult<T> =
  | { ok: true; result: T }
  | { ok: false; error: string };

async function callTelegram<T>(
  botToken: string,
  method: string,
  payload?: Record<string, unknown>,
): Promise<TelegramResult<T>> {
  if (!botToken) {
    return { ok: false, error: "توکن ربات تنظیم نشده است" };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
      cache: "no-store",
    });
    const data = (await res.json()) as {
      ok: boolean;
      result?: T;
      description?: string;
    };
    if (!data.ok) {
      return { ok: false, error: data.description || "خطای نامشخص از تلگرام" };
    }
    return { ok: true, result: data.result as T };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "خطا در اتصال به تلگرام",
    };
  }
}

export interface TelegramChatInfo {
  id: number;
  title?: string;
  username?: string;
  first_name?: string;
  type: string;
}

export interface TelegramMeInfo {
  id: number;
  username?: string;
  first_name: string;
}

export function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  return callTelegram<{ message_id: number }>(botToken, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

export function getTelegramMe(botToken: string) {
  return callTelegram<TelegramMeInfo>(botToken, "getMe");
}

export function getTelegramChat(botToken: string, chatId: string) {
  return callTelegram<TelegramChatInfo>(botToken, "getChat", { chat_id: chatId });
}

export function setTelegramWebhook(botToken: string, url: string) {
  return callTelegram<boolean>(botToken, "setWebhook", {
    url,
    allowed_updates: ["message", "channel_post", "my_chat_member"],
  });
}

export function deleteTelegramWebhook(botToken: string) {
  return callTelegram<boolean>(botToken, "deleteWebhook", {});
}

export function getTelegramWebhookInfo(botToken: string) {
  return callTelegram<{
    url: string;
    pending_update_count: number;
    last_error_message?: string;
  }>(botToken, "getWebhookInfo");
}
