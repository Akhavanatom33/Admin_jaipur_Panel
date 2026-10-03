import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// --- Admin users for the web panel ---
export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Singleton settings row ---
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  botToken: text("bot_token"),
  botUsername: varchar("bot_username", { length: 255 }),
  webhookSecret: varchar("webhook_secret", { length: 128 }),
  minIntervalSeconds: integer("min_interval_seconds").notNull().default(30),
  schedulerTickSeconds: integer("scheduler_tick_seconds").notNull().default(15),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Registered Telegram chats / groups / channels ---
export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  chatId: varchar("chat_id", { length: 64 }).notNull().unique(),
  title: text("title").notNull().default(""),
  type: varchar("type", { length: 32 }).notNull().default("group"),
  isActive: boolean("is_active").notNull().default(true),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Recurring rotating-message campaigns ---
export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  messages: jsonb("messages").$type<string[]>().notNull().default([]),
  chatIds: jsonb("chat_ids").$type<string[]>().notNull().default([]),
  intervalSeconds: integer("interval_seconds").notNull().default(3600),
  isActive: boolean("is_active").notNull().default(false),
  currentIndex: integer("current_index").notNull().default(0),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- One-off scheduled posts ---
export const scheduledPosts = pgTable("scheduled_posts", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  chatIds: jsonb("chat_ids").$type<string[]>().notNull().default([]),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Delivery logs ---
export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  source: varchar("source", { length: 16 }).notNull(),
  refId: integer("ref_id"),
  chatId: varchar("chat_id", { length: 64 }),
  chatTitle: text("chat_title"),
  messagePreview: text("message_preview"),
  status: varchar("status", { length: 16 }).notNull(),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
