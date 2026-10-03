# ربات زمان‌بند پیام تلگرام — نسخه مستقل Python

این نسخه بدون نیاز به Node.js و بدون پنل وب کار می‌کند؛ تمام مدیریت (ساخت کمپین،
زمان‌بندی پست، مشاهده گزارش‌ها) از طریق دستورات همان بات تلگرام انجام می‌شود.

بات فقط با **Bot API رسمی تلگرام** کار می‌کند (توکن از BotFather) و هیچ‌وقت با
شماره تلفن یا کد به اکانت شخصی کسی وارد نمی‌شود. برای فعالیت در یک گروه، باید
خودتان بات را به آن گروه اضافه و ادمین کنید.

## نصب

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# مقادیر .env را پر کنید (TELEGRAM_BOT_TOKEN و ADMIN_TELEGRAM_USER_IDS)
python bot.py
```

## گرفتن شناسه عددی خودتان
در تلگرام به بات پیام `/myid` بدهید و عدد برگشتی را در `ADMIN_TELEGRAM_USER_IDS` بگذارید
(می‌توانید چند آیدی را با کاما جدا کنید). سپس بات را دوباره اجرا کنید.

## افزودن یک گروه
1. بات را به گروه/کانال اضافه و ادمین کنید (دسترسی ارسال پیام).
2. داخل گروه دستور `/id` را بفرستید؛ بات خودش گروه را ثبت می‌کند.

## دستورات اصلی
| دستور | کاربرد |
|---|---|
| `/newcampaign` | ساخت کمپین تکرارشونده (چند پیام چرخشی با فاصله دلخواه) |
| `/campaigns` | مشاهده و شروع/توقف/حذف کمپین‌ها |
| `/schedule` | زمان‌بندی یک پست تک‌باره برای تاریخ/ساعت مشخص (UTC) |
| `/scheduled` | مشاهده پست‌های زمان‌بندی‌شده |
| `/logs` | تاریخچه ارسال‌ها |
| `/chats` | لیست گروه‌های ثبت‌شده |
| `/cancel` | لغو عملیات در حال انجام |

## اجرای دائمی با systemd (پیشنهادی برای سرور لینوکسی)
```bash
sudo mkdir -p /opt/telegram-panel-bot
sudo cp -r . /opt/telegram-panel-bot
cd /opt/telegram-panel-bot
python3 -m venv venv && venv/bin/pip install -r requirements.txt
sudo cp telegram-panel-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now telegram-panel-bot
sudo journalctl -u telegram-panel-bot -f
```

## نکته ایمنی
حداقل فاصله مجاز بین ارسال‌های یک کمپین (`MIN_INTERVAL_SECONDS`, پیش‌فرض ۳۰ ثانیه)
به‌صورت کد رعایت می‌شود تا این ابزار هرگز به رفتار اسپم/فلود در گروه‌ها تبدیل نشود
و اکانت بات بن نشود.
