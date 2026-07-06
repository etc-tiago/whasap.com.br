import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uuid as pgUuid,
} from "drizzle-orm/pg-core";

import { organizations } from "./organizacoes";

export const instanceProviderEnum = pgEnum("instance_provider", ["cloud_api", "evolution"]);
export const instanceStatusEnum = pgEnum("instance_status", [
  "pending_connection",
  "pending_payment",
  "provisioning",
  "disconnected",
  "connected",
  "deactivated",
]);

export const instances = pgTable("instances", {
  id: serial("id").primaryKey(),
  uuid: pgUuid("uuid").notNull().unique().defaultRandom(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  provider: instanceProviderEnum("provider").notNull(),
  status: instanceStatusEnum("status").notNull().default("pending_connection"),
  asaasSubscriptionId: text("asaas_subscription_id"),
  conversationLimit: integer("conversation_limit").notNull().default(1000),
  evolutionSecretName: text("evolution_secret_name"),
  evolutionInstanceName: text("evolution_instance_name"),
  cloudPhoneNumberId: text("cloud_phone_number_id"),
  cloudWabaId: text("cloud_waba_id"),
  cloudAccessTokenSecretName: text("cloud_access_token_secret_name"),
  provisionAttempts: integer("provision_attempts").notNull().default(0),
  connectedAt: timestamp("connected_at"),
  trialEndsAt: timestamp("trial_ends_at"),
  deactivatedAt: timestamp("deactivated_at"),
  excluidoEm: timestamp("excluido_em"),
  criadoEm: timestamp("criado_em").notNull(),
  atualizadoEm: timestamp("atualizado_em").notNull(),
});

export const instanceAddons = pgTable("instance_addons", {
  id: serial("id").primaryKey(),
  instanceId: integer("instance_id")
    .notNull()
    .references(() => instances.id, { onDelete: "cascade" }),
  asaasSubscriptionId: text("asaas_subscription_id").notNull(),
  conversationPackSize: integer("conversation_pack_size").notNull().default(1000),
  active: boolean("active").notNull().default(true),
  criadoEm: timestamp("criado_em").notNull(),
});
