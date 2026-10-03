"""Centralized configuration loaded from environment variables / .env file."""
import os

from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()

# Comma separated list of Telegram numeric user IDs allowed to control the bot.
# Use the /myid command (works for anyone) to discover your own ID.
_raw_admin_ids = os.environ.get("ADMIN_TELEGRAM_USER_IDS", "").strip()
ADMIN_USER_IDS = {
    int(part) for part in _raw_admin_ids.split(",") if part.strip().isdigit()
}

DB_PATH = os.environ.get("DB_PATH", "data.db")

# Safety floor: no campaign may repeat faster than this, so the bot can never
# be turned into a flood/spam tool.
MIN_INTERVAL_SECONDS = int(os.environ.get("MIN_INTERVAL_SECONDS", "30"))

# How often (seconds) the background loop checks for due campaigns/posts.
TICK_SECONDS = int(os.environ.get("TICK_SECONDS", "5"))
