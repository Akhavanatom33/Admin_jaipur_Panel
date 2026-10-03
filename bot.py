"""
Telegram group/channel message scheduler bot (standalone Python edition).

Runs entirely on the official Telegram Bot API (python-telegram-bot). The
bot must be explicitly added as a member/admin of a group or channel before
it can read or post anything there - there is no "login with phone number"
flow and no personal-account takeover, so normal use stays within Telegram's
Terms of Service.

Features
--------
- Recurring campaigns that rotate through several messages on a timer
  (sequential or random order), with a safety floor on how fast they may
  repeat so the bot can never be turned into a flood/spam tool.
- One-off scheduled posts for a specific date/time.
- Automatic chat registration when the bot is added to a group (or via the
  /id command), and automatic campaign shutdown if the bot is removed.
- Full delivery log.
- Every control command is restricted to the Telegram user ID(s) configured
  in ADMIN_TELEGRAM_USER_IDS.
"""
import logging
from datetime import datetime, timedelta, timezone
from functools import wraps

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    ChatMemberHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

import config
import db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("panel-bot")

# Conversation states
NC_NAME, NC_CHAT, NC_INTERVAL, NC_ROTATION, NC_MESSAGES = range(5)
SC_CHAT, SC_TEXT, SC_TIME = range(5, 8)


def admin_only(func):
    @wraps(func)
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE, *args, **kwargs):
        user = update.effective_user
        if not config.ADMIN_USER_IDS:
            await update.effective_message.reply_text(
                "⚠️ هنوز ADMIN_TELEGRAM_USER_IDS تنظیم نشده است.\n"
                "با دستور /myid شناسه عددی خودتان را بردارید و آن را در متغیر محیطی "
                "ADMIN_TELEGRAM_USER_IDS سرور قرار دهید، سپس بات را ری‌استارت کنید."
            )
            return ConversationHandler.END
        if not user or user.id not in config.ADMIN_USER_IDS:
            await update.effective_message.reply_text("⛔️ شما اجازه استفاده از این بات را ندارید.")
            return ConversationHandler.END
        return await func(update, context, *args, **kwargs)

    return wrapper


# ---------------------------------------------------------------- basics --

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.effective_message.reply_text(
        "سلام! این بات یک زمان‌بند پیام برای گروه/کانال‌های تلگرام است.\n\n"
        "دستورات اصلی:\n"
        "/myid - گرفتن شناسه عددی خودتان\n"
        "/chats - لیست گروه‌های ثبت‌شده\n"
        "/newcampaign - ساخت کمپین تکرارشونده جدید\n"
        "/campaigns - مدیریت کمپین‌ها\n"
        "/schedule - زمان‌بندی یک پست تک‌باره\n"
        "/scheduled - لیست پست‌های زمان‌بندی‌شده\n"
        "/logs - تاریخچه ارسال‌ها\n"
        "/cancel - لغو عملیات جاری"
    )


async def cmd_myid(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.effective_message.reply_text(f"شناسه عددی شما: `{update.effective_user.id}`", parse_mode="Markdown")


async def cmd_id_in_group(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat = update.effective_chat
    if chat.type not in ("group", "supergroup"):
        await update.effective_message.reply_text("این دستور فقط داخل گروه کار می‌کند.")
        return
    db.upsert_chat(str(chat.id), chat.title or str(chat.id), chat.type, chat.username, True)
    await update.effective_message.reply_text(f"✅ این گروه ثبت شد.\nآیدی گروه: `{chat.id}`", parse_mode="Markdown")


cmd_id_in_group = admin_only(cmd_id_in_group)


async def on_my_chat_member(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Keep the chats table in sync automatically when the bot is added/removed."""
    mcm = update.my_chat_member
    if not mcm:
        return
    chat = mcm.chat
    status = mcm.new_chat_member.status
    active = status in ("member", "administrator", "creator")
    if chat.type in ("group", "supergroup", "channel"):
        db.upsert_chat(str(chat.id), chat.title or str(chat.id), chat.type, chat.username, active)
        logger.info("chat %s (%s) membership status -> %s", chat.id, chat.title, status)


async def cmd_chats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    rows = db.list_chats()
    if not rows:
        await update.effective_message.reply_text(
            "هنوز گروهی ثبت نشده. بات را به گروه اضافه و ادمین کنید، سپس در آن گروه دستور /id را بفرستید."
        )
        return
    lines = ["📋 گروه‌ها/کانال‌های ثبت‌شده:\n"]
    for r in rows:
        state = "🟢 فعال" if r["is_active"] else "🔴 غیرفعال"
        lines.append(f"- {r['title']}  (`{r['chat_id']}`)  {state}")
    await update.effective_message.reply_text("\n".join(lines), parse_mode="Markdown")


cmd_chats = admin_only(cmd_chats)


async def cmd_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    await update.effective_message.reply_text("عملیات لغو شد.")
    return ConversationHandler.END


# ---------------------------------------------------------- new campaign --

async def newcampaign_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    await update.effective_message.reply_text("نام این کمپین را وارد کنید (مثلا: تبلیغ کانال من):")
    return NC_NAME


newcampaign_start = admin_only(newcampaign_start)


async def newcampaign_name(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["name"] = update.effective_message.text.strip()
    chats = [c for c in db.list_chats() if c["is_active"]]
    if not chats:
        await update.effective_message.reply_text(
            "هیچ گروه فعالی ثبت نشده. ابتدا بات را به گروه اضافه و /id را در آن بفرستید."
        )
        return ConversationHandler.END
    keyboard = [
        [InlineKeyboardButton(c["title"], callback_data=f"ncchat:{c['chat_id']}")] for c in chats
    ]
    await update.effective_message.reply_text(
        "گروه/کانال مقصد را انتخاب کنید:", reply_markup=InlineKeyboardMarkup(keyboard)
    )
    return NC_CHAT


async def newcampaign_chat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    chat_id = query.data.split(":", 1)[1]
    context.user_data["chat_id"] = chat_id
    await query.edit_message_text(f"گروه انتخاب شد: `{chat_id}`", parse_mode="Markdown")
    await query.message.reply_text(
        f"فاصله ارسال بین پیام‌ها را به ثانیه وارد کنید (حداقل {config.MIN_INTERVAL_SECONDS} ثانیه). مثلا: 80"
    )
    return NC_INTERVAL


async def newcampaign_interval(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.effective_message.text.strip()
    if not text.isdigit() or int(text) < config.MIN_INTERVAL_SECONDS:
        await update.effective_message.reply_text(
            f"لطفاً یک عدد صحیح بزرگتر یا مساوی {config.MIN_INTERVAL_SECONDS} وارد کنید."
        )
        return NC_INTERVAL
    context.user_data["interval"] = int(text)
    keyboard = [
        [
            InlineKeyboardButton("ترتیبی", callback_data="ncrot:sequential"),
            InlineKeyboardButton("تصادفی", callback_data="ncrot:random"),
        ]
    ]
    await update.effective_message.reply_text("شیوه چرخش پیام‌ها؟", reply_markup=InlineKeyboardMarkup(keyboard))
    return NC_ROTATION


async def newcampaign_rotation(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    mode = query.data.split(":", 1)[1]
    context.user_data["rotation"] = mode
    context.user_data["messages"] = []
    await query.edit_message_text(f"شیوه چرخش: {mode}")
    await query.message.reply_text(
        "حالا پیام‌های چرخه را یکی‌یکی بفرستید (هر پیام جدا).\n"
        "وقتی تمام شد دستور /done را بفرستید."
    )
    return NC_MESSAGES


async def newcampaign_collect_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.effective_message.text
    context.user_data.setdefault("messages", []).append(text)
    await update.effective_message.reply_text(
        f"✅ پیام شماره {len(context.user_data['messages'])} ذخیره شد. پیام بعدی یا /done را بفرستید."
    )
    return NC_MESSAGES


async def newcampaign_done(update: Update, context: ContextTypes.DEFAULT_TYPE):
    data = context.user_data
    messages = data.get("messages", [])
    if not messages:
        await update.effective_message.reply_text("حداقل یک پیام لازم است. پیام را بفرستید یا /cancel را بزنید.")
        return NC_MESSAGES

    campaign_id = db.create_campaign(data["name"], data["chat_id"], data["interval"], data["rotation"], messages)
    context.user_data.clear()

    keyboard = [[InlineKeyboardButton("▶️ شروع این کمپین", callback_data=f"camp:start:{campaign_id}")]]
    await update.effective_message.reply_text(
        f"🎉 کمپین «{campaign_id}» با {len(messages)} پیام ساخته شد.\nآماده شروع است.",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )
    return ConversationHandler.END


newcampaign_conv = ConversationHandler(
    entry_points=[CommandHandler("newcampaign", newcampaign_start)],
    states={
        NC_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, newcampaign_name)],
        NC_CHAT: [CallbackQueryHandler(newcampaign_chat, pattern=r"^ncchat:")],
        NC_INTERVAL: [MessageHandler(filters.TEXT & ~filters.COMMAND, newcampaign_interval)],
        NC_ROTATION: [CallbackQueryHandler(newcampaign_rotation, pattern=r"^ncrot:")],
        NC_MESSAGES: [
            CommandHandler("done", newcampaign_done),
            MessageHandler(filters.TEXT & ~filters.COMMAND, newcampaign_collect_message),
        ],
    },
    fallbacks=[CommandHandler("cancel", cmd_cancel)],
)


# -------------------------------------------------------------- campaigns --

def format_campaign_line(c: dict) -> str:
    state = "🟢 در حال اجرا" if c["status"] == "running" else "⏸ متوقف"
    return (
        f"#{c['id']} — {c['name']}\n"
        f"  مقصد: `{c['chat_id']}` | فاصله: {c['interval_seconds']}s | چرخش: {c['rotation_mode']}\n"
        f"  وضعیت: {state} | تعداد پیام: {len(c['messages'])}"
    )


async def cmd_campaigns(update: Update, context: ContextTypes.DEFAULT_TYPE):
    campaigns = db.list_campaigns()
    if not campaigns:
        await update.effective_message.reply_text("هنوز کمپینی ساخته نشده. از /newcampaign استفاده کنید.")
        return

    for c in campaigns:
        toggle_label = "⏸ توقف" if c["status"] == "running" else "▶️ شروع"
        toggle_action = "pause" if c["status"] == "running" else "start"
        keyboard = [
            [
                InlineKeyboardButton(toggle_label, callback_data=f"camp:{toggle_action}:{c['id']}"),
                InlineKeyboardButton("🗑 حذف", callback_data=f"camp:delete:{c['id']}"),
            ]
        ]
        await update.effective_message.reply_text(
            format_campaign_line(c), parse_mode="Markdown", reply_markup=InlineKeyboardMarkup(keyboard)
        )


cmd_campaigns = admin_only(cmd_campaigns)


async def on_campaign_action(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user = update.effective_user
    if not config.ADMIN_USER_IDS or not user or user.id not in config.ADMIN_USER_IDS:
        await query.answer("⛔️ اجازه ندارید", show_alert=True)
        return
    await query.answer()

    _, action, raw_id = query.data.split(":")
    campaign_id = int(raw_id)

    if action == "start":
        db.set_campaign_status(campaign_id, "running", db.now_iso())
        await query.edit_message_text(f"▶️ کمپین #{campaign_id} شروع شد.")
    elif action == "pause":
        db.set_campaign_status(campaign_id, "stopped")
        await query.edit_message_text(f"⏸ کمپین #{campaign_id} متوقف شد.")
    elif action == "delete":
        db.delete_campaign(campaign_id)
        await query.edit_message_text(f"🗑 کمپین #{campaign_id} حذف شد.")


# ---------------------------------------------------------------- schedule --

async def schedule_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    chats = [c for c in db.list_chats() if c["is_active"]]
    if not chats:
        await update.effective_message.reply_text("هیچ گروه فعالی ثبت نشده است.")
        return ConversationHandler.END
    keyboard = [[InlineKeyboardButton(c["title"], callback_data=f"scchat:{c['chat_id']}")] for c in chats]
    await update.effective_message.reply_text("گروه مقصد را انتخاب کنید:", reply_markup=InlineKeyboardMarkup(keyboard))
    return SC_CHAT


schedule_start = admin_only(schedule_start)


async def schedule_chat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    context.user_data["chat_id"] = query.data.split(":", 1)[1]
    await query.edit_message_text("متن پیام را بفرستید:")
    return SC_TEXT


async def schedule_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["content"] = update.effective_message.text
    await update.effective_message.reply_text(
        "زمان ارسال را به وقت UTC و با فرمت `YYYY-MM-DD HH:MM` وارد کنید.\nمثال: 2026-01-01 14:30",
        parse_mode="Markdown",
    )
    return SC_TIME


async def schedule_time(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.effective_message.text.strip()
    try:
        dt = datetime.strptime(text, "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
    except ValueError:
        await update.effective_message.reply_text("فرمت نادرست است. دوباره با فرمت YYYY-MM-DD HH:MM وارد کنید.")
        return SC_TIME

    data = context.user_data
    post_id = db.create_scheduled_post(data["chat_id"], data["content"], dt.isoformat())
    context.user_data.clear()
    await update.effective_message.reply_text(f"✅ پست #{post_id} برای {text} UTC زمان‌بندی شد.")
    return ConversationHandler.END


schedule_conv = ConversationHandler(
    entry_points=[CommandHandler("schedule", schedule_start)],
    states={
        SC_CHAT: [CallbackQueryHandler(schedule_chat, pattern=r"^scchat:")],
        SC_TEXT: [MessageHandler(filters.TEXT & ~filters.COMMAND, schedule_text)],
        SC_TIME: [MessageHandler(filters.TEXT & ~filters.COMMAND, schedule_time)],
    },
    fallbacks=[CommandHandler("cancel", cmd_cancel)],
)


async def cmd_scheduled(update: Update, context: ContextTypes.DEFAULT_TYPE):
    posts = db.list_scheduled_posts()[:20]
    if not posts:
        await update.effective_message.reply_text("پستی زمان‌بندی نشده است.")
        return
    lines = []
    for p in posts:
        lines.append(f"#{p['id']} [{p['status']}] -> `{p['chat_id']}` @ {p['scheduled_at']}\n  {p['content'][:60]}")
    await update.effective_message.reply_text("\n\n".join(lines), parse_mode="Markdown")


cmd_scheduled = admin_only(cmd_scheduled)


async def cmd_logs(update: Update, context: ContextTypes.DEFAULT_TYPE):
    logs = db.list_logs(20)
    if not logs:
        await update.effective_message.reply_text("هنوز ارسالی ثبت نشده است.")
        return
    lines = []
    for log in logs:
        icon = "✅" if log["status"] == "success" else "❌"
        lines.append(f"{icon} {log['sent_at']} -> `{log['chat_id']}`: {log['content'][:50]}")
    await update.effective_message.reply_text("\n".join(lines), parse_mode="Markdown")


cmd_logs = admin_only(cmd_logs)


# --------------------------------------------------------- background tick --

FATAL_ERROR_HINTS = ("kicked", "chat not found", "not enough rights", "forbidden", "bot was blocked")


async def tick(context: ContextTypes.DEFAULT_TYPE):
    now = db.now_iso()

    for campaign in db.due_campaigns(now):
        campaign = dict(campaign)
        msgs = db.get_campaign_messages(campaign["id"])
        if not msgs:
            db.set_campaign_status(campaign["id"], "stopped")
            continue

        if campaign["rotation_mode"] == "random":
            import random

            msg = random.choice(msgs)
            next_index = campaign["current_index"]
        else:
            idx = campaign["current_index"] % len(msgs)
            msg = msgs[idx]
            next_index = (idx + 1) % len(msgs)

        interval = max(campaign["interval_seconds"], config.MIN_INTERVAL_SECONDS)
        next_run_at = (datetime.now(timezone.utc) + timedelta(seconds=interval)).isoformat()

        try:
            await context.bot.send_message(chat_id=campaign["chat_id"], text=msg["content"])
            db.add_log(campaign["chat_id"], msg["content"], "success", campaign_id=campaign["id"])
        except Exception as exc:  # noqa: BLE001
            error_text = str(exc)
            db.add_log(campaign["chat_id"], msg["content"], "error", campaign_id=campaign["id"], error_text=error_text)
            if any(hint in error_text.lower() for hint in FATAL_ERROR_HINTS):
                db.set_campaign_status(campaign["id"], "stopped")
                db.deactivate_chat(campaign["chat_id"])
                logger.warning("campaign %s stopped (fatal error: %s)", campaign["id"], error_text)
                continue

        db.update_campaign_after_send(campaign["id"], next_run_at, next_index, now)

    for post in db.due_scheduled_posts(now):
        try:
            await context.bot.send_message(chat_id=post["chat_id"], text=post["content"])
            db.mark_scheduled_post(post["id"], "sent", sent_at=db.now_iso())
            db.add_log(post["chat_id"], post["content"], "success")
        except Exception as exc:  # noqa: BLE001
            db.mark_scheduled_post(post["id"], "error", error_text=str(exc))
            db.add_log(post["chat_id"], post["content"], "error", error_text=str(exc))


# --------------------------------------------------------------------- main --

def main():
    if not config.BOT_TOKEN:
        raise SystemExit("TELEGRAM_BOT_TOKEN تنظیم نشده است. آن را در .env قرار دهید.")

    db.init_db()

    application = Application.builder().token(config.BOT_TOKEN).build()

    application.add_handler(CommandHandler("start", cmd_start))
    application.add_handler(CommandHandler("myid", cmd_myid))
    application.add_handler(CommandHandler("id", cmd_id_in_group))
    application.add_handler(CommandHandler("chatid", cmd_id_in_group))
    application.add_handler(CommandHandler("chats", cmd_chats))
    application.add_handler(CommandHandler("campaigns", cmd_campaigns))
    application.add_handler(CommandHandler("scheduled", cmd_scheduled))
    application.add_handler(CommandHandler("logs", cmd_logs))
    application.add_handler(CommandHandler("cancel", cmd_cancel))

    application.add_handler(newcampaign_conv)
    application.add_handler(schedule_conv)

    application.add_handler(CallbackQueryHandler(on_campaign_action, pattern=r"^camp:"))
    application.add_handler(ChatMemberHandler(on_my_chat_member, ChatMemberHandler.MY_CHAT_MEMBER))

    application.job_queue.run_repeating(tick, interval=config.TICK_SECONDS, first=5)

    logger.info("Bot starting (polling mode)...")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
