"""Lightweight SQLite persistence layer (no ORM needed for this scale)."""
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Optional

import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'group',
    username TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    added_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    chat_id TEXT NOT NULL,
    interval_seconds INTEGER NOT NULL DEFAULT 60,
    rotation_mode TEXT NOT NULL DEFAULT 'sequential',
    status TEXT NOT NULL DEFAULT 'stopped',
    current_index INTEGER NOT NULL DEFAULT 0,
    next_run_at TEXT,
    last_run_at TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaign_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS scheduled_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    content TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    error_text TEXT,
    sent_at TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS message_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    chat_id TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL,
    error_text TEXT,
    sent_at TEXT NOT NULL
);
"""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def get_conn():
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_conn() as conn:
        conn.executescript(SCHEMA)


# ---------------- chats ----------------

def upsert_chat(chat_id: str, title: str, type_: str, username: Optional[str], is_active: bool):
    with get_conn() as conn:
        existing = conn.execute("SELECT id FROM chats WHERE chat_id = ?", (chat_id,)).fetchone()
        if existing:
            conn.execute(
                "UPDATE chats SET title=?, type=?, username=?, is_active=? WHERE chat_id=?",
                (title, type_, username, int(is_active), chat_id),
            )
        else:
            conn.execute(
                "INSERT INTO chats (chat_id, title, type, username, is_active, added_at) VALUES (?,?,?,?,?,?)",
                (chat_id, title, type_, username, int(is_active), now_iso()),
            )


def list_chats() -> list[sqlite3.Row]:
    with get_conn() as conn:
        return conn.execute("SELECT * FROM chats ORDER BY added_at DESC").fetchall()


def delete_chat(chat_pk: int):
    with get_conn() as conn:
        conn.execute("DELETE FROM chats WHERE id = ?", (chat_pk,))


def deactivate_chat(chat_id: str):
    with get_conn() as conn:
        conn.execute("UPDATE chats SET is_active = 0 WHERE chat_id = ?", (chat_id,))


# ---------------- campaigns ----------------

def create_campaign(name: str, chat_id: str, interval_seconds: int, rotation_mode: str, messages: list[str]) -> int:
    with get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO campaigns (name, chat_id, interval_seconds, rotation_mode, status, current_index, created_at)
                   VALUES (?,?,?,?, 'stopped', 0, ?)""",
            (name, chat_id, interval_seconds, rotation_mode, now_iso()),
        )
        campaign_id = cur.lastrowid
        for i, content in enumerate(messages):
            conn.execute(
                "INSERT INTO campaign_messages (campaign_id, content, sort_order) VALUES (?,?,?)",
                (campaign_id, content, i),
            )
        return campaign_id


def list_campaigns() -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM campaigns ORDER BY created_at DESC").fetchall()
        result = []
        for row in rows:
            msgs = conn.execute(
                "SELECT * FROM campaign_messages WHERE campaign_id = ? ORDER BY sort_order ASC",
                (row["id"],),
            ).fetchall()
            item = dict(row)
            item["messages"] = [dict(m) for m in msgs]
            result.append(item)
        return result


def get_campaign(campaign_id: int) -> Optional[sqlite3.Row]:
    with get_conn() as conn:
        return conn.execute("SELECT * FROM campaigns WHERE id = ?", (campaign_id,)).fetchone()


def get_campaign_messages(campaign_id: int) -> list[sqlite3.Row]:
    with get_conn() as conn:
        return conn.execute(
            "SELECT * FROM campaign_messages WHERE campaign_id = ? ORDER BY sort_order ASC", (campaign_id,)
        ).fetchall()


def set_campaign_status(campaign_id: int, status: str, next_run_at: Optional[str] = None):
    with get_conn() as conn:
        if next_run_at is not None:
            conn.execute(
                "UPDATE campaigns SET status=?, next_run_at=? WHERE id=?", (status, next_run_at, campaign_id)
            )
        else:
            conn.execute("UPDATE campaigns SET status=? WHERE id=?", (status, campaign_id))


def update_campaign_after_send(campaign_id: int, next_run_at: str, current_index: int, last_run_at: str):
    with get_conn() as conn:
        conn.execute(
            "UPDATE campaigns SET next_run_at=?, current_index=?, last_run_at=? WHERE id=?",
            (next_run_at, current_index, last_run_at, campaign_id),
        )


def delete_campaign(campaign_id: int):
    with get_conn() as conn:
        conn.execute("DELETE FROM campaign_messages WHERE campaign_id = ?", (campaign_id,))
        conn.execute("DELETE FROM campaigns WHERE id = ?", (campaign_id,))


def due_campaigns(now: str) -> list[sqlite3.Row]:
    with get_conn() as conn:
        return conn.execute(
            "SELECT * FROM campaigns WHERE status = 'running' AND (next_run_at IS NULL OR next_run_at <= ?)",
            (now,),
        ).fetchall()


# ---------------- scheduled posts ----------------

def create_scheduled_post(chat_id: str, content: str, scheduled_at: str) -> int:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO scheduled_posts (chat_id, content, scheduled_at, status, created_at) VALUES (?,?,?,'pending',?)",
            (chat_id, content, scheduled_at, now_iso()),
        )
        return cur.lastrowid


def list_scheduled_posts() -> list[sqlite3.Row]:
    with get_conn() as conn:
        return conn.execute("SELECT * FROM scheduled_posts ORDER BY scheduled_at DESC").fetchall()


def due_scheduled_posts(now: str) -> list[sqlite3.Row]:
    with get_conn() as conn:
        return conn.execute(
            "SELECT * FROM scheduled_posts WHERE status = 'pending' AND scheduled_at <= ?", (now,)
        ).fetchall()


def mark_scheduled_post(post_id: int, status: str, error_text: Optional[str] = None, sent_at: Optional[str] = None):
    with get_conn() as conn:
        conn.execute(
            "UPDATE scheduled_posts SET status=?, error_text=?, sent_at=? WHERE id=?",
            (status, error_text, sent_at, post_id),
        )


def cancel_scheduled_post(post_id: int):
    with get_conn() as conn:
        conn.execute("UPDATE scheduled_posts SET status='cancelled' WHERE id = ? AND status = 'pending'", (post_id,))


# ---------------- logs ----------------

def add_log(chat_id: str, content: str, status: str, campaign_id: Optional[int] = None, error_text: Optional[str] = None):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO message_logs (campaign_id, chat_id, content, status, error_text, sent_at) VALUES (?,?,?,?,?,?)",
            (campaign_id, chat_id, content, status, error_text, now_iso()),
        )


def list_logs(limit: int = 30) -> list[sqlite3.Row]:
    with get_conn() as conn:
        return conn.execute("SELECT * FROM message_logs ORDER BY sent_at DESC LIMIT ?", (limit,)).fetchall()
