import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const webhookEvents = pgTable("webhook_events", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  eventId: text("event_id"),
  payload: text("payload").notNull(),
  processedAt: timestamp("processed_at"),
  criadoEm: timestamp("criado_em").notNull(),
});

export const asaasWebhookLog = pgTable("asaas_webhook_log", {
  id: serial("id").primaryKey(),
  asaasEventId: text("asaas_event_id").notNull().unique(),
  type: text("type").notNull(),
  payload: text("payload").notNull(),
  processedAt: timestamp("processed_at"),
  criadoEm: timestamp("criado_em").notNull(),
});
