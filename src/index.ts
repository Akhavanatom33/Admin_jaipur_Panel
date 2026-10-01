import { hashPassword, randomPassword } from './security.ts';

export interface Env {
  DB: D1Database;
  BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  ADMIN_API_TOKEN: string;
  ADMIN_IDS: string;
  GAME_URL: string;
}

type TelegramResult<T> = { ok: boolean; result?: T; description?: string; error_code?: number };
type Update = {
  update_id: number;
  message?: { chat: { id: number; type: string }; from?: { id: number; username?: string }; text?: string; document?: { file_id: string; file_name?: string; file_size?: number; mime_type?: string } };
  callback_query?: { id: string; from: { id: number }; data?: string; message?: { chat: { id: number }; message_id: number } };
};

type BotState = { adminId: number; state: string; payload?: Record<string, string> };

type UserRow = {
  id: string;
  username: string;
  username_norm?: string;
  password_hash?: string;
  coins: number;
  gems: number;
  blocked: number;
  games_played: number;
  wins: number;
  losses: number;
  created_at: number;
  last_login_at: number | null;
};

type BackupPayload = {
  format: 'jaipur-d1-backup';
  version: 1;
  exportedAt: string;
  users: UserRow[];
  gameHistory: Array<Record<string, unknown>>;
  auditLogs: Array<Record<string, unknown>>;
};

const jsonHeaders = { 'Content-Type': 'application/json' };

function adminSet(env: Env): Set<number> {
  return new Set(env.ADMIN_IDS.split(',').map((x) => Number(x.trim())).filter((x) => Number.isInteger(x) && x > 0));
}

function isAdmin(env: Env, id: number): boolean { return adminSet(env).has(id); }

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(value: unknown): string {
  if (!value) return '—';
  try { return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(Number(value))); } catch { return String(value); }
}

function menuKeyboard() {
  return { inline_keyboard: [
    [{ text: '📊 آمار سایت', callback_data: 'admin:stats' }, { text: '👤 جستجوی کاربر', callback_data: 'admin:search' }],
    [{ text: '🪙 مدیریت سکه', callback_data: 'admin:coins' }, { text: '💎 مدیریت جم', callback_data: 'admin:gems' }],
    [{ text: '🔐 تغییر رمز کاربر', callback_data: 'admin:password' }, { text: '🚫 مسدودسازی', callback_data: 'admin:block' }],
    [{ text: '🎮 بازی‌های اخیر', callback_data: 'admin:games' }, { text: '🧾 لاگ مدیریت', callback_data: 'admin:logs' }],
    [{ text: '🗄️ دریافت بکاپ', callback_data: 'admin:backup' }, { text: '📤 بازیابی دیتابیس', callback_data: 'admin:restore' }],
    [{ text: '🧹 پاکسازی نشست‌ها', callback_data: 'admin:cleanup' }, { text: '📖 راهنما', callback_data: 'admin:help' }],
  ] };
}

function backKeyboard() { return { inline_keyboard: [[{ text: '⬅️ بازگشت به پنل', callback_data: 'admin:menu' }]] }; }
function blockKeyboard(userId: string, blocked: boolean) {
  return { inline_keyboard: [
    [{ text: blocked ? '✅ رفع مسدودی' : '🚫 مسدود کردن', callback_data: `user:block:${userId}:${blocked ? '0' : '1'}` }],
    [{ text: '🔐 تغییر رمز', callback_data: `user:reset:${userId}` }, { text: '🔒 بستن نشست‌ها', callback_data: `user:sessions:${userId}` }],
    [{ text: '⬅️ پنل', callback_data: 'admin:menu' }],
  ] };
}

async function telegram<T>(env: Env, method: string, payload: unknown, multipart = false): Promise<TelegramResult<T>> {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`;
  const init: RequestInit = { method: 'POST' };
  if (multipart) {
    init.body = payload as BodyInit;
  } else {
    init.headers = jsonHeaders;
    init.body = JSON.stringify(payload);
  }
  const res = await fetch(url, init);
  return await res.json() as TelegramResult<T>;
}

async function sendMessage(env: Env, chatId: number, text: string, replyMarkup?: unknown) {
  return telegram(env, 'sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...(replyMarkup ? { reply_markup: replyMarkup } : {}) });
}

async function answerCallback(env: Env, id: string) { await telegram(env, 'answerCallbackQuery', { callback_query_id: id }); }

async function editMessage(env: Env, chatId: number, messageId: number, text: string, replyMarkup?: unknown) {
  return telegram(env, 'editMessageText', { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', ...(replyMarkup ? { reply_markup: replyMarkup } : {}) });
}

async function getState(db: D1Database, adminId: number): Promise<BotState | null> {
  const row = await db.prepare('SELECT state, payload_json FROM admin_states WHERE admin_id = ? LIMIT 1').bind(String(adminId)).first<{ state: string; payload_json: string | null }>();
  if (!row) return null;
  let payload: Record<string, string> | undefined;
  try { payload = row.payload_json ? JSON.parse(row.payload_json) : undefined; } catch { payload = undefined; }
  return { adminId, state: row.state, payload };
}

async function setState(db: D1Database, adminId: number, state: string, payload?: Record<string, string>) {
  await db.prepare('INSERT INTO admin_states (admin_id, state, payload_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(admin_id) DO UPDATE SET state = excluded.state, payload_json = excluded.payload_json, updated_at = excluded.updated_at')
    .bind(String(adminId), state, payload ? JSON.stringify(payload) : null, Date.now()).run();
}

async function clearState(db: D1Database, adminId: number) { await db.prepare('DELETE FROM admin_states WHERE admin_id = ?').bind(String(adminId)).run(); }

async function audit(db: D1Database, actorId: number, action: string, targetUserId: string | null, details: unknown = null) {
  await db.prepare('INSERT INTO audit_logs (actor_type, actor_id, action, target_user_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind('admin', String(actorId), action, targetUserId, JSON.stringify(details), Date.now()).run();
}

function normalizeUsername(input: string) { return input.normalize('NFKC').trim().toLocaleLowerCase(); }

async function findUsers(db: D1Database, query: string): Promise<UserRow[]> {
  const q = normalizeUsername(query);
  if (!q) return [];
  const result = await db.prepare(`SELECT id, username, coins, gems, blocked, games_played, wins, losses, created_at, last_login_at FROM users WHERE username_norm = ? OR username_norm LIKE ? ORDER BY created_at DESC LIMIT 10`)
    .bind(q, `%${q}%`).all<UserRow>();
  return result.results ?? [];
}

async function sendUserCard(env: Env, chatId: number, user: UserRow) {
  const text = [
    `👤 <b>${escapeHtml(user.username)}</b>`,
    `شناسه: <code>${escapeHtml(user.id)}</code>`,
    `🪙 سکه: <b>${Number(user.coins)}</b>`,
    `💎 جم: <b>${Number(user.gems)}</b>`,
    `🎮 بازی: ${Number(user.games_played)}  |  🏆 برد: ${Number(user.wins)}  |  ❌ باخت: ${Number(user.losses)}`,
    `🚦 وضعیت: ${Number(user.blocked) ? '🚫 مسدود' : '✅ فعال'}`,
    `📅 ثبت‌نام: ${fmtDate(user.created_at)}`,
    `🕘 آخرین ورود: ${fmtDate(user.last_login_at)}`,
  ].join('\n');
  await sendMessage(env, chatId, text, blockKeyboard(user.id, Number(user.blocked) === 1));
}

async function showMenu(env: Env, chatId: number) {
  await sendMessage(env, chatId, '<b>🎛 پنل مدیریت Jaipur Online</b>\n\nیکی از عملیات زیر را انتخاب کن:', menuKeyboard());
}

async function showStats(env: Env, chatId: number) {
  const [users, games, registrations, sessions] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS c FROM users').first<{ c: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS c FROM game_history').first<{ c: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS c FROM users WHERE created_at >= ?').bind(Date.now() - 24 * 60 * 60 * 1000).first<{ c: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS c FROM sessions WHERE expires_at > ?').bind(Date.now()).first<{ c: number }>(),
  ]);
  let presence = { onlinePlayers: 0, playingPlayers: 0, activeRooms: 0 };
  try {
    const base = env.GAME_URL.replace(/\/+$/, '');
    const r = await fetch(`${base}/api/admin/presence`, { headers: { 'X-Admin-API-Token': env.ADMIN_API_TOKEN } });
    if (r.ok) presence = await r.json() as typeof presence;
  } catch { /* game presence is optional */ }

  await sendMessage(env, chatId, [
    '<b>📊 آمار لحظه‌ای سایت</b>',
    `👥 کاربران ثبت‌نام‌شده: <b>${Number(users?.c ?? 0)}</b>`,
    `🟢 آنلاین: <b>${Number((presence as any).onlinePlayers ?? 0)}</b>`,
    `🎮 در حال بازی: <b>${Number((presence as any).playingPlayers ?? 0)}</b>`,
    `🏠 اتاق‌های فعال: <b>${Number((presence as any).activeRooms ?? 0)}</b>`,
    `🕐 ثبت‌نام ۲۴ ساعت اخیر: <b>${Number(registrations?.c ?? 0)}</b>`,
    `🏁 بازی‌های ثبت‌شده: <b>${Number(games?.c ?? 0)}</b>`,
    `🔑 نشست‌های فعال: <b>${Number(sessions?.c ?? 0)}</b>`,
  ].join('\n'), backKeyboard());
}

async function showRecentGames(env: Env, chatId: number) {
  const r = await env.DB.prepare(`
    SELECT g.id, g.room_id, g.round_count, g.ended_at, u1.username AS p1, u2.username AS p2, uw.username AS winner
    FROM game_history g
    JOIN users u1 ON u1.id = g.player1_user_id
    JOIN users u2 ON u2.id = g.player2_user_id
    LEFT JOIN users uw ON uw.id = g.winner_user_id
    ORDER BY g.ended_at DESC LIMIT 10
  `).all<{ id: number; room_id: string; round_count: number; ended_at: number; p1: string; p2: string; winner: string | null }>();
  const rows = r.results ?? [];
  const body = rows.length ? rows.map((g, i) => `${i + 1}. <b>${escapeHtml(g.p1)}</b> vs <b>${escapeHtml(g.p2)}</b> → 🏆 ${escapeHtml(g.winner ?? 'مساوی')}\n   🏠 ${g.room_id} · ${g.round_count} راند · ${fmtDate(g.ended_at)}`).join('\n') : 'هنوز هیچ بازی کاملی ثبت نشده است.';
  await sendMessage(env, chatId, `<b>🎮 آخرین بازی‌ها</b>\n\n${body}`, backKeyboard());
}

async function showLogs(env: Env, chatId: number) {
  const r = await env.DB.prepare(`SELECT actor_id, action, target_user_id, created_at FROM audit_logs WHERE actor_type = 'admin' ORDER BY id DESC LIMIT 15`).all<{ actor_id: string | null; action: string; target_user_id: string | null; created_at: number }>();
  const rows = r.results ?? [];
  const body = rows.length ? rows.map((x, i) => `${i + 1}. <code>${escapeHtml(x.action)}</code> · ادمین <code>${escapeHtml(x.actor_id)}</code> · هدف <code>${escapeHtml(x.target_user_id ?? '—')}</code> · ${fmtDate(x.created_at)}`).join('\n') : 'لاگ مدیریتی وجود ندارد.';
  await sendMessage(env, chatId, `<b>🧾 آخرین عملیات مدیریتی</b>\n\n${body}`, backKeyboard());
}

async function cleanup(env: Env, chatId: number, adminId: number) {
  const r = await env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(Date.now()).run();
  await audit(env.DB, adminId, 'cleanup_sessions', null, { removed: r.meta?.changes ?? 0 });
  await sendMessage(env, chatId, `🧹 پاکسازی انجام شد.\nتعداد نشست‌های منقضی حذف‌شده: <b>${Number(r.meta?.changes ?? 0)}</b>`, backKeyboard());
}

async function buildBackup(db: D1Database): Promise<BackupPayload> {
  const [users, games, logs] = await Promise.all([
    db.prepare('SELECT id, username, username_norm, password_hash, coins, gems, blocked, games_played, wins, losses, created_at, last_login_at FROM users ORDER BY created_at').all<UserRow>(),
    db.prepare('SELECT * FROM game_history ORDER BY id').all<Record<string, unknown>>(),
    db.prepare('SELECT * FROM audit_logs ORDER BY id').all<Record<string, unknown>>(),
  ]);
  return { format: 'jaipur-d1-backup', version: 1, exportedAt: new Date().toISOString(), users: users.results ?? [], gameHistory: games.results ?? [], auditLogs: logs.results ?? [] };
}

async function sendBackup(env: Env, chatId: number, adminId: number, caption = '🗄️ بکاپ دیتابیس Jaipur Online') {
  const backup = await buildBackup(env.DB);
  const text = JSON.stringify(backup);
  const bytes = new TextEncoder().encode(text);
  if (bytes.byteLength > 18_000_000) {
    await sendMessage(env, chatId, '⚠️ حجم بکاپ برای دریافت از طریق Bot API بیش از حد امن تنظیم‌شده است. از Wrangler برای `d1 export` استفاده کن.', backKeyboard());
    return;
  }
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('caption', caption);
  form.append('document', new Blob([bytes], { type: 'application/json' }), `jaipur-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const res = await telegram(env, 'sendDocument', form, true);
  if (!res.ok) throw new Error(res.description ?? 'Telegram could not send backup.');
  await audit(env.DB, adminId, 'backup_export', null, { users: backup.users.length, games: backup.gameHistory.length, logs: backup.auditLogs.length });
}

function validBackup(value: unknown): value is BackupPayload {
  if (!value || typeof value !== 'object') return false;
  const b = value as Record<string, unknown>;
  return b.format === 'jaipur-d1-backup' && b.version === 1 && Array.isArray(b.users) && Array.isArray(b.gameHistory) && Array.isArray(b.auditLogs);
}

async function restoreBackup(db: D1Database, backup: BackupPayload) {
  await db.batch([db.prepare('DELETE FROM sessions'), db.prepare('DELETE FROM game_history'), db.prepare('DELETE FROM audit_logs'), db.prepare('DELETE FROM users')]);
  const chunks = <T,>(items: T[], size: number) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
  for (const group of chunks(backup.users, 25)) {
    await db.batch(group.map((u) => db.prepare(`INSERT INTO users (id, username, username_norm, password_hash, coins, gems, blocked, games_played, wins, losses, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(u.id, u.username, u.username_norm ?? normalizeUsername(u.username), u.password_hash, Number(u.coins ?? 0), Number(u.gems ?? 0), Number(u.blocked ?? 0), Number(u.games_played ?? 0), Number(u.wins ?? 0), Number(u.losses ?? 0), Number(u.created_at ?? Date.now()), u.last_login_at == null ? null : Number(u.last_login_at))));
  }
  for (const group of chunks(backup.gameHistory, 25)) {
    await db.batch(group.map((g) => db.prepare(`INSERT INTO game_history (id, room_id, player1_user_id, player2_user_id, winner_user_id, round_count, result_json, ended_at, game_record_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(Number(g.id), String(g.room_id), String(g.player1_user_id), String(g.player2_user_id), g.winner_user_id == null ? null : String(g.winner_user_id), Number(g.round_count ?? 0), String(g.result_json ?? '{}'), Number(g.ended_at ?? Date.now()), String(g.game_record_id ?? crypto.randomUUID()))));
  }
  for (const group of chunks(backup.auditLogs, 25)) {
    await db.batch(group.map((a) => db.prepare(`INSERT INTO audit_logs (id, actor_type, actor_id, action, target_user_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(Number(a.id), String(a.actor_type), a.actor_id == null ? null : String(a.actor_id), String(a.action), a.target_user_id == null ? null : String(a.target_user_id), String(a.details_json ?? 'null'), Number(a.created_at ?? Date.now()))));
  }
}

async function handleUserText(env: Env, chatId: number, adminId: number, text: string) {
  const state = await getState(env.DB, adminId);
  if (!state || state.state === 'menu') return showMenu(env, chatId);

  if (state.state === 'search_user') {
    const users = await findUsers(env.DB, text);
    await clearState(env.DB, adminId);
    if (!users.length) return sendMessage(env, chatId, '🔎 کاربری با این نام پیدا نشد.', backKeyboard());
    for (const user of users.slice(0, 5)) await sendUserCard(env, chatId, user);
    return;
  }

  if (state.state === 'coins_user' || state.state === 'gems_user') {
    const users = await findUsers(env.DB, text);
    if (!users.length) return sendMessage(env, chatId, 'کاربر پیدا نشد. نام کاربری را دوباره ارسال کن یا /cancel را بزن.');
    if (users.length > 1) return sendMessage(env, chatId, `چند کاربر پیدا شد. یک نام کاربری دقیق‌تر ارسال کن:\n${users.map((u) => `• ${escapeHtml(u.username)}`).join('\n')}`);
    await setState(env.DB, adminId, state.state === 'coins_user' ? 'coins_amount' : 'gems_amount', { userId: users[0].id, username: users[0].username });
    return sendMessage(env, chatId, `کاربر <b>${escapeHtml(users[0].username)}</b> انتخاب شد.\n\nفرمت مقدار:\n<code>+200</code> افزایش\n<code>-50</code> کاهش\n<code>=1000</code> تعیین مقدار دقیق\n<code>0</code> صفر کردن\n\nحالا مقدار را ارسال کن.`);
  }

  if (state.state === 'coins_amount' || state.state === 'gems_amount') {
    const raw = text.trim();
    const match = raw.match(/^([+=-]?)(\d{1,12})$/);
    if (!match) return sendMessage(env, chatId, 'فرمت درست نیست. مثال: <code>+200</code> یا <code>-50</code> یا <code>=1000</code>.');
    const n = Math.max(0, Math.min(9_999_999_999, Number(match[2])));
    const field = state.state === 'coins_amount' ? 'coins' : 'gems';
    const userId = state.payload?.userId;
    if (!userId) return showMenu(env, chatId);
    if (match[1] === '=') await env.DB.prepare(`UPDATE users SET ${field} = ? WHERE id = ?`).bind(n, userId).run();
    else if (match[1] === '-') await env.DB.prepare(`UPDATE users SET ${field} = MAX(0, ${field} - ?) WHERE id = ?`).bind(n, userId).run();
    else await env.DB.prepare(`UPDATE users SET ${field} = ${field} + ? WHERE id = ?`).bind(n, userId).run();
    const user = await env.DB.prepare(`SELECT id, username, coins, gems, blocked, games_played, wins, losses, created_at, last_login_at FROM users WHERE id = ?`).bind(userId).first<UserRow>();
    await clearState(env.DB, adminId);
    await audit(env.DB, adminId, field === 'coins' ? 'adjust_coins' : 'adjust_gems', userId, { input: raw });
    return user ? sendUserCard(env, chatId, user) : sendMessage(env, chatId, 'عملیات انجام شد اما کاربر دیگر وجود ندارد.', backKeyboard());
  }

  if (state.state === 'password_user') {
    const users = await findUsers(env.DB, text);
    if (!users.length) return sendMessage(env, chatId, 'کاربر پیدا نشد. دوباره نام کاربری را ارسال کن.');
    if (users.length > 1) return sendMessage(env, chatId, `چند کاربر پیدا شد:\n${users.map((u) => `• ${escapeHtml(u.username)}`).join('\n')}\nنام دقیق را ارسال کن.`);
    const password = randomPassword();
    const hash = await hashPassword(password);
    await env.DB.batch([env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, users[0].id), env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(users[0].id)]);
    await clearState(env.DB, adminId);
    await audit(env.DB, adminId, 'reset_password', users[0].id, { username: users[0].username });
    return sendMessage(env, chatId, `🔐 رمز کاربر <b>${escapeHtml(users[0].username)}</b> تغییر کرد.\n\nرمز موقت جدید:\n<code>${escapeHtml(password)}</code>\n\n⚠️ نشست‌های قبلی کاربر هم بسته شد.`, backKeyboard());
  }

  if (state.state === 'block_user') {
    const users = await findUsers(env.DB, text);
    if (!users.length) return sendMessage(env, chatId, 'کاربر پیدا نشد. دوباره نام کاربری را ارسال کن.');
    if (users.length > 1) return sendMessage(env, chatId, `چند کاربر پیدا شد:\n${users.map((u) => `• ${escapeHtml(u.username)}`).join('\n')}\nنام دقیق را ارسال کن.`);
    await clearState(env.DB, adminId);
    return sendUserCard(env, chatId, users[0]);
  }

  return showMenu(env, chatId);
}

async function handleCallback(env: Env, query: NonNullable<Update['callback_query']>) {
  const adminId = query.from.id;
  await answerCallback(env, query.id);
  if (!isAdmin(env, adminId)) return;
  const chatId = query.message?.chat.id;
  const messageId = query.message?.message_id;
  if (!chatId) return;
  const data = query.data ?? '';

  if (data === 'admin:menu') { await clearState(env.DB, adminId); return showMenu(env, chatId); }
  if (data === 'admin:stats') return showStats(env, chatId);
  if (data === 'admin:games') return showRecentGames(env, chatId);
  if (data === 'admin:logs') return showLogs(env, chatId);
  if (data === 'admin:cleanup') return cleanup(env, chatId, adminId);
  if (data === 'admin:help') return sendMessage(env, chatId, [
    '<b>📖 راهنمای پنل</b>',
    '',
    '👤 <b>جستجوی کاربر:</b> نام کاربری را بفرست؛ مشخصات، موجودی و سابقه نمایش داده می‌شود.',
    '🪙 <b>سکه:</b> بعد از انتخاب کاربر <code>+200</code> برای افزایش، <code>-50</code> برای کاهش و <code>=0</code> برای تعیین مستقیم بفرست.',
    '💎 <b>جم:</b> دقیقاً مانند سکه.',
    '🔐 <b>تغییر رمز:</b> یک رمز موقت امن ساخته می‌شود و تمام نشست‌های قبلی کاربر بسته می‌شود.',
    '🚫 <b>مسدودسازی:</b> کاربر دیگر نمی‌تواند وارد حساب شود؛ از همان کارت می‌توان رفع مسدودی کرد.',
    '🗄️ <b>بکاپ:</b> کاربران، موجودی‌ها، تاریخچه بازی و لاگ مدیریتی را به فایل JSON می‌فرستد.',
    '📤 <b>بازیابی:</b> قبل از جایگزینی، یک بکاپ ایمنی از دیتابیس فعلی ساخته و ارسال می‌شود؛ سپس فایل JSON انتخابی Restore می‌شود و نشست‌ها پاک می‌شوند.',
    '🟢 <b>آنلاین/در حال بازی:</b> از Worker خود بازی به‌صورت لحظه‌ای خوانده می‌شود.',
    '🧾 <b>لاگ:</b> تغییرات حساس ادمین‌ها را ثبت و قابل مشاهده می‌کند.',
    '',
    'برای لغو هر عملیات /cancel را بزن.'
  ].join('\n'), backKeyboard());
  if (data === 'admin:search') { await setState(env.DB, adminId, 'search_user'); return sendMessage(env, chatId, '👤 نام کاربری را ارسال کن:'); }
  if (data === 'admin:coins') { await setState(env.DB, adminId, 'coins_user'); return sendMessage(env, chatId, '🪙 نام کاربری موردنظر را ارسال کن:'); }
  if (data === 'admin:gems') { await setState(env.DB, adminId, 'gems_user'); return sendMessage(env, chatId, '💎 نام کاربری موردنظر را ارسال کن:'); }
  if (data === 'admin:password') { await setState(env.DB, adminId, 'password_user'); return sendMessage(env, chatId, '🔐 نام کاربری را ارسال کن تا رمز آن تغییر کند:'); }
  if (data === 'admin:block') { await setState(env.DB, adminId, 'block_user'); return sendMessage(env, chatId, '🚫 نام کاربری را ارسال کن:'); }
  if (data === 'admin:backup') { await clearState(env.DB, adminId); try { await sendBackup(env, chatId, adminId); } catch (e) { await sendMessage(env, chatId, `❌ بکاپ ارسال نشد: ${escapeHtml(e)}`, backKeyboard()); } return; }
  if (data === 'admin:restore') { await setState(env.DB, adminId, 'restore_wait'); return sendMessage(env, chatId, '📤 فایل JSON بکاپ را همینجا ارسال کن. برای جلوگیری از اشتباه، فقط بکاپ ساخته‌شده توسط همین ربات قابل Restore است.'); }

  const userAction = data.match(/^user:(reset|sessions|block):([a-f0-9-]+)(?::(0|1))?$/);
  if (userAction) {
    const [, action, userId, flag] = userAction;
    if (action === 'reset') {
      const user = await env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(userId).first<{ username: string }>();
      if (!user) return sendMessage(env, chatId, 'کاربر پیدا نشد.', backKeyboard());
      const password = randomPassword();
      const hash = await hashPassword(password);
      await env.DB.batch([env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, userId), env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId)]);
      await audit(env.DB, adminId, 'reset_password', userId, { username: user.username });
      return sendMessage(env, chatId, `🔐 رمز <b>${escapeHtml(user.username)}</b> تغییر کرد:\n\n<code>${escapeHtml(password)}</code>\n\nنشست‌های قبلی بسته شدند.`, backKeyboard());
    }
    if (action === 'sessions') {
      const r = await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
      await audit(env.DB, adminId, 'revoke_sessions', userId, { removed: r.meta?.changes ?? 0 });
      return sendMessage(env, chatId, `🔒 ${Number(r.meta?.changes ?? 0)} نشست کاربر بسته شد.`, backKeyboard());
    }
    const blocked = flag === '1' ? 1 : 0;
    await env.DB.prepare('UPDATE users SET blocked = ? WHERE id = ?').bind(blocked, userId).run();
    if (blocked) await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
    const user = await env.DB.prepare('SELECT id, username, coins, gems, blocked, games_played, wins, losses, created_at, last_login_at FROM users WHERE id = ?').bind(userId).first<UserRow>();
    await audit(env.DB, adminId, blocked ? 'block_user' : 'unblock_user', userId, null);
    return user ? sendUserCard(env, chatId, user) : sendMessage(env, chatId, 'کاربر پیدا نشد.', backKeyboard());
  }

  return editMessage(env, chatId, messageId ?? 0, 'عملیات ناشناخته است.', backKeyboard());
}

async function handleUpdate(env: Env, update: Update) {
  if (update.callback_query) return handleCallback(env, update.callback_query);
  const message = update.message;
  if (!message) return;
  const chatId = message.chat.id;
  const fromId = message.from?.id ?? 0;
  const text = message.text?.trim() ?? '';

  if (text === '/start') {
    if (isAdmin(env, fromId)) return sendMessage(env, chatId, '<b>👋 به ربات مدیریت Jaipur Online خوش آمدی.</b>\n\nدسترسی مدیریتی شما تأیید شد. برای باز کردن پنل از /admin استفاده کن.');
    return sendMessage(env, chatId, '👋 خوش آمدی. این ربات برای مدیریت داخلی بازی است.');
  }
  if (text === '/admin') {
    if (!isAdmin(env, fromId)) return sendMessage(env, chatId, '⛔️ دسترسی شما به پنل مدیریت فعال نیست.');
    await setState(env.DB, fromId, 'menu');
    return showMenu(env, chatId);
  }
  if (text === '/cancel') {
    await clearState(env.DB, fromId);
    return sendMessage(env, chatId, '✅ عملیات لغو شد.', isAdmin(env, fromId) ? menuKeyboard() : undefined);
  }
  if (!isAdmin(env, fromId)) return;

  const state = await getState(env.DB, fromId);
  if (state?.state === 'restore_wait' && message.document) {
    try {
      if ((message.document.file_size ?? 0) > 20_000_000) throw new Error('این فایل از محدودیت دریافت مستقیم Telegram بزرگ‌تر است.');
      const info = await telegram<{ file_path: string }>(env, 'getFile', { file_id: message.document.file_id });
      if (!info.ok || !info.result?.file_path) throw new Error(info.description ?? 'Telegram file unavailable.');
      const file = await fetch(`https://api.telegram.org/file/bot${env.BOT_TOKEN}/${info.result.file_path}`);
      const raw = await file.text();
      const backup = JSON.parse(raw) as unknown;
      if (!validBackup(backup)) throw new Error('فرمت بکاپ Jaipur معتبر نیست.');
      const safety = await buildBackup(env.DB);
      const safetyText = JSON.stringify(safety);
      const form = new FormData();
      form.append('chat_id', String(chatId));
      form.append('caption', '🚨 بکاپ ایمنی قبل از Restore');
      form.append('document', new Blob([safetyText], { type: 'application/json' }), `jaipur-pre-restore-${Date.now()}.json`);
      const safetySend = await telegram(env, 'sendDocument', form, true);
      if (!safetySend.ok) throw new Error('بکاپ ایمنی قبل از Restore ارسال نشد؛ Restore برای امنیت متوقف شد.');
      await restoreBackup(env.DB, backup);
      await clearState(env.DB, fromId);
      await audit(env.DB, fromId, 'database_restore', null, { users: backup.users.length, games: backup.gameHistory.length, logs: backup.auditLogs.length });
      return sendMessage(env, chatId, `✅ Restore با موفقیت انجام شد.\n👥 کاربران: ${backup.users.length}\n🎮 بازی‌ها: ${backup.gameHistory.length}\n🧾 لاگ‌ها: ${backup.auditLogs.length}\n\n🔒 همه نشست‌ها پاک شده‌اند و کاربران برای ورود دوباره باید Login کنند.`, backKeyboard());
    } catch (e) {
      await clearState(env.DB, fromId);
      return sendMessage(env, chatId, `❌ Restore انجام نشد:\n${escapeHtml(e)}`, backKeyboard());
    }
  }

  return handleUserText(env, chatId, fromId, text);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'GET') return new Response('Jaipur Admin Bot is running.');
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    if (env.TELEGRAM_WEBHOOK_SECRET && request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.TELEGRAM_WEBHOOK_SECRET) return new Response('Forbidden', { status: 403 });
    let update: Update;
    try { update = await request.json() as Update; } catch { return new Response('Bad Request', { status: 400 }); }
    try { await handleUpdate(env, update); } catch (e) { console.error('telegram update failed', e); }
    return new Response('OK');
  },
};
