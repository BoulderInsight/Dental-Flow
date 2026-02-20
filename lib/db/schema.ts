import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  integer,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// Enums
export const categoryEnum = pgEnum("category", [
  "business",
  "personal",
  "ambiguous",
]);

export const categorizationSourceEnum = pgEnum("categorization_source", [
  "rule",
  "ml",
  "user",
]);

export const matchTypeEnum = pgEnum("match_type", [
  "vendor",
  "description",
  "amount_range",
]);

export const reviewStatusEnum = pgEnum("review_status", [
  "in_progress",
  "completed",
]);

export const roleEnum = pgEnum("role", ["owner", "manager", "accountant"]);

// Tables

export const practices = pgTable("practices", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  qboRealmId: text("qbo_realm_id"),
  qboTokens: text("qbo_tokens"), // AES-256-GCM encrypted JSON
  fiscalYearStart: integer("fiscal_year_start").default(1), // month 1-12
  practiceAddresses: jsonb("practice_addresses").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    practiceId: uuid("practice_id")
      .references(() => practices.id, { onDelete: "cascade" })
      .notNull(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").default("owner").notNull(),
    emailVerified: timestamp("email_verified"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    index("users_practice_idx").on(table.practiceId),
  ]
);

// NextAuth adapter tables
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refreshToken: text("refresh_token"),
    accessToken: text("access_token"),
    expiresAt: integer("expires_at"),
    tokenType: text("token_type"),
    scope: text("scope"),
    idToken: text("id_token"),
    sessionState: text("session_state"),
  },
  (table) => [
    uniqueIndex("accounts_provider_idx").on(
      table.provider,
      table.providerAccountId
    ),
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionToken: text("session_token").notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    expires: timestamp("expires").notNull(),
  },
  (table) => [uniqueIndex("sessions_token_idx").on(table.sessionToken)]
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires").notNull(),
  },
  (table) => [
    uniqueIndex("verification_tokens_idx").on(table.identifier, table.token),
  ]
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    practiceId: uuid("practice_id")
      .references(() => practices.id, { onDelete: "cascade" })
      .notNull(),
    qboTxnId: text("qbo_txn_id").notNull(),
    date: timestamp("date").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    vendorName: text("vendor_name"),
    description: text("description"),
    accountRef: text("account_ref"),
    rawJson: jsonb("raw_json"),
    syncedAt: timestamp("synced_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("txn_qbo_id_idx").on(table.practiceId, table.qboTxnId),
    index("txn_practice_date_idx").on(table.practiceId, table.date),
  ]
);

export const categorizations = pgTable(
  "categorizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id")
      .references(() => transactions.id, { onDelete: "cascade" })
      .notNull(),
    category: categoryEnum("category").notNull(),
    confidence: integer("confidence").notNull(), // 0-100
    source: categorizationSourceEnum("source").notNull(),
    ruleId: uuid("rule_id").references(() => userRules.id),
    reasoning: text("reasoning"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("cat_txn_idx").on(table.transactionId),
    index("cat_confidence_idx").on(table.confidence),
  ]
);

export const userRules = pgTable(
  "user_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    practiceId: uuid("practice_id")
      .references(() => practices.id, { onDelete: "cascade" })
      .notNull(),
    matchType: matchTypeEnum("match_type").notNull(),
    matchValue: text("match_value").notNull(),
    category: categoryEnum("category").notNull(),
    priority: integer("priority").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("rules_practice_idx").on(table.practiceId)]
);

export const reviewSessions = pgTable(
  "review_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    practiceId: uuid("practice_id")
      .references(() => practices.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id").references(() => users.id),
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),
    status: reviewStatusEnum("status").default("in_progress").notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [index("review_practice_idx").on(table.practiceId)]
);

export const forecasts = pgTable("forecasts", {
  id: uuid("id").defaultRandom().primaryKey(),
  practiceId: uuid("practice_id")
    .references(() => practices.id, { onDelete: "cascade" })
    .notNull(),
  forecastDate: timestamp("forecast_date").notNull(),
  periodMonths: integer("period_months").notNull(),
  method: text("method").notNull(),
  parametersJson: jsonb("parameters_json"),
  resultsJson: jsonb("results_json"),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    practiceId: uuid("practice_id")
      .references(() => practices.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_practice_idx").on(table.practiceId),
    index("audit_entity_idx").on(table.entityType, table.entityId),
  ]
);

// Type exports
export type Practice = typeof practices.$inferSelect;
export type NewPractice = typeof practices.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Categorization = typeof categorizations.$inferSelect;
export type NewCategorization = typeof categorizations.$inferInsert;
export type UserRule = typeof userRules.$inferSelect;
export type NewUserRule = typeof userRules.$inferInsert;
export type ReviewSession = typeof reviewSessions.$inferSelect;
export type Forecast = typeof forecasts.$inferSelect;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
