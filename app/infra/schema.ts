import {
  pgTable,
  varchar,
  uuid,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";

// Users table
export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    role: varchar("role", { length: 50 }).notNull().default("VIEWER"),
    username: varchar("username", { length: 100 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    emailIdx: index("idx_users_email").on(table.email),
    usernameIdx: index("idx_users_username").on(table.username),
  })
);

// Events table (Immutable append-only event log)
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    aggregateId: varchar("aggregate_id", { length: 255 }).notNull(),
    aggregateType: varchar("aggregate_type", { length: 100 }).notNull(),
    eventType: varchar("event_type", { length: 150 }).notNull(),
    version: integer("version").notNull(),
    payload: jsonb("payload").notNull(),
    metadata: jsonb("metadata").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    aggregateIdx: index("idx_events_aggregate").on(
      table.aggregateId,
      table.version
    ),
    eventTypeIdx: index("idx_events_type_occurred").on(
      table.eventType,
      table.occurredAt
    ),
    aggregateVersionUnique: uniqueIndex("idx_events_aggregate_version").on(
      table.aggregateId,
      table.version
    ),
  })
);

// Alerts table
export const alerts = pgTable(
  "alerts",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    type: varchar("type", { length: 100 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("OPEN"),
    severity: varchar("severity", { length: 20 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    sourceEventId: uuid("source_event_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    statusIdx: index("idx_alerts_status").on(table.status),
    severityIdx: index("idx_alerts_severity").on(table.severity),
    createdIdx: index("idx_alerts_created").on(table.createdAt),
  })
);

// Operations log table
export const operationsLog = pgTable(
  "operations_log",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    eventId: uuid("event_id").notNull().unique(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    category: varchar("category", { length: 50 }).notNull(),
    eventName: varchar("event_name", { length: 150 }).notNull(),
    summary: varchar("summary", { length: 500 }).notNull(),
    linkId: varchar("link_id", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    timeIdx: index("idx_operations_log_time").on(table.timestamp),
    categoryIdx: index("idx_operations_log_category").on(
      table.category,
      table.timestamp
    ),
    linkIdx: index("idx_operations_log_link").on(table.linkId),
  })
);

// Peers status table
export const peersStatus = pgTable(
  "peers_status",
  {
    peerAddress: varchar("peer_address", { length: 255 }).primaryKey(),
    version: varchar("version", { length: 50 }),
    banScore: integer("ban_score").default(0),
    connected: boolean("connected").notNull(),
    lastSeen: timestamp("last_seen", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    connectedIdx: index("idx_peers_connected").on(table.connected),
    lastSeenIdx: index("idx_peers_last_seen").on(table.lastSeen),
  })
);

// Rule definitions table
export const ruleDefinitions = pgTable(
  "rule_definitions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 255 }).notNull().unique(),
    description: text("description"),
    ruleType: varchar("rule_type", { length: 100 }).notNull(),
    configuration: jsonb("configuration").notNull(),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    activeIdx: index("idx_rules_active").on(table.isActive),
    typeIdx: index("idx_rules_type").on(table.ruleType),
  })
);

// Relations
export const eventsRelations = relations(events, ({ many }) => ({
  alerts: many(alerts),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  sourceEvent: one(events, {
    fields: [alerts.sourceEventId],
    references: [events.id],
  }),
}));

export const operationsLogRelations = relations(operationsLog, ({ one }) => ({
  event: one(events, {
    fields: [operationsLog.eventId],
    references: [events.id],
  }),
}));
