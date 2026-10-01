# Jaipur Admin Bot

ربات مدیریتی مستقل برای Jaipur Online. این Worker مستقیماً به همان Cloudflare D1 بازی متصل می‌شود و برای آمار لحظه‌ای، مدیریت کاربران، سکه، جم، تغییر رمز، مسدودسازی، بکاپ و Restore و لاگ مدیریتی استفاده می‌شود.

## Required secrets

- `BOT_TOKEN`: توکن ربات از BotFather
- `TELEGRAM_WEBHOOK_SECRET`: یک رشته تصادفی طولانی برای محافظت از Webhook
- `ADMIN_API_TOKEN`: دقیقاً همان Secret موجود در Worker بازی

## Variables

- `ADMIN_IDS`: آی‌دی عددی ادمین‌ها، جداشده با کاما
- `GAME_URL`: آدرس Worker بازی

## D1

`wrangler.jsonc` باید به همان D1 Database پروژه Jaipur اشاره کند؛ فقط `database_id` را در هر دو پروژه یکسان قرار بده.

## Deploy

```bash
npm install
npx wrangler login
npx wrangler deploy
```

بعد Secretها را تنظیم کن:

```bash
npx wrangler secret put BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put ADMIN_API_TOKEN
```

سپس Webhook را برای آدرس Worker این ربات تنظیم کن:

```text
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook
```

URL Webhook باید به روت Worker این پروژه اشاره کند و Header `X-Telegram-Bot-Api-Secret-Token` را Telegram بر اساس `secret_token` تنظیم می‌کند.

### دستورات

`/start` خوش‌آمدگویی

`/admin` پنل مدیریت برای آی‌دی‌های مجاز

`/cancel` لغو عملیات جاری

### فرمت تغییر موجودی

`+200` افزایش

`-50` کاهش، با کف صفر

`=1000` تعیین مستقیم

`0` صفر کردن

### Backup / Restore

Backup یک JSON شامل users، game_history و audit_logs است. Sessionها عمداً داخل Backup نیستند. قبل از هر Restore، ربات یک Backup ایمنی از دیتابیس فعلی برای همان ادمین می‌فرستد. Restore فقط فایل Backup معتبر Jaipur را می‌پذیرد و بعد از Restore تمام نشست‌های قبلی پاک می‌شوند.

Bot API دریافت فایل با `getFile` را برای فایل‌های حداکثر 20MB محدود می‌کند؛ برای دیتابیس‌های بزرگ‌تر از Wrangler/D1 export استفاده کن.
