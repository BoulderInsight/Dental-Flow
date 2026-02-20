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
  boolean,
  date,
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

export const periodTypeEnum = pgEnum("period_type", [
  "monthly",
  "quarterly",
  "annual",
]);

export const plaidConnectionStatusEnum = pgEnum("plaid_connection_status", [
  "active",
  "error",
  "pending_reauth",
]);

// Tables

export const practices = pgTable("practices", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  industry: text("industry").default("dental").notNull(),
  qboRealmId: text("qbo_realm_id"),
  qboTokens: text("qbo_tokens"), // AES-256-GCM encrypted JSON
  fiscalYearStart: integer("fiscal_year_start").default(1), // month 1-12
  practiceAddresses: jsonb("practice_addresses").$type<string[]>().default([]),
  reserveThreshold: numeric("reserve_threshold", { precision: 12, scale: 2 }).default("10000.00"),
  estimatedValue: numeric("estimated_value", { precision: 14, scale: 2 }),
  realEstateValue: numeric("real_estate_value", { precision: 14, scale: 2 }),
  otherAssets: numeric("other_assets", { precision: 14, scale: 2 }),
  otherLiabilities: numeric("other_liabilities", { precision: 14, scale: 2 }),
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

// User-Practice join table (multi-practice support)
export const userPractices = pgTable(
  "user_practices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    practiceId: uuid("practice_id")
      .references(() => practices.id, { onDelete: "cascade" })
      .notNull(),
    role: roleEnum("role").default("owner").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    invitedBy: uuid("invited_by").references(() => users.id),
    invitedAt: timestamp("invited_at"),
    acceptedAt: timestamp("accepted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_practices_user_practice_idx").on(
      table.userId,
      table.practiceId
    ),
    index("user_practices_user_idx").on(table.userId),
    index("user_practices_practice_idx").on(table.practiceId),
  ]
);

// Industry config table
export const industryConfigs = pgTable(
  "industry_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    practiceId: uuid("practice_id").references(() => practices.id, {
      onDelete: "cascade",
    }),
    industrySlug: text("industry_slug").notNull(),
    configJson: jsonb("config_json").notNull(),
    isCustom: boolean("is_custom").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("industry_configs_practice_slug_idx").on(
      table.practiceId,
      table.industrySlug
    ),
    index("industry_configs_slug_idx").on(table.industrySlug),
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

export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    practiceId: uuid("practice_id")
      .references(() => practices.id, { onDelete: "cascade" })
      .notNull(),
    year: integer("year").notNull(),
    accountRef: text("account_ref").notNull(),
    monthlyTarget: numeric("monthly_target", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("budgets_practice_year_account_idx").on(
      table.practiceId,
      table.year,
      table.accountRef
    ),
  ]
);

export const financialSnapshots = pgTable(
  "financial_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    practiceId: uuid("practice_id")
      .references(() => practices.id, { onDelete: "cascade" })
      .notNull(),
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),
    periodType: periodTypeEnum("period_type").notNull(),
    revenue: numeric("revenue", { precision: 12, scale: 2 }),
    operatingExpenses: numeric("operating_expenses", { precision: 12, scale: 2 }),
    overheadRatio: numeric("overhead_ratio", { precision: 5, scale: 4 }),
    netOperatingIncome: numeric("net_operating_income", { precision: 12, scale: 2 }),
    ownerCompensation: numeric("owner_compensation", { precision: 12, scale: 2 }),
    trueNetProfit: numeric("true_net_profit", { precision: 12, scale: 2 }),
    businessFreeCash: numeric("business_free_cash", { precision: 12, scale: 2 }),
    personalFreeCash: numeric("personal_free_cash", { precision: 12, scale: 2 }),
    combinedFreeCash: numeric("combined_free_cash", { precision: 12, scale: 2 }),
    excessCash: numeric("excess_cash", { precision: 12, scale: 2 }),
    computedAt: timestamp("computed_at").defaultNow().notNull(),
  },
  (table) => [
    index("snapshot_practice_period_idx").on(
      table.practiceId,
      table.periodType,
      table.periodStart
    ),
  ]
);

// Plaid tables
export const plaidConnections = pgTable(
  "plaid_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    practiceId: uuid("practice_id")
      .references(() => practices.id, { onDelete: "cascade" })
      .notNull(),
    plaidItemId: text("plaid_item_id").notNull(),
    accessToken: text("access_token").notNull(), // AES-256-GCM encrypted
    institutionName: text("institution_name").notNull(),
    institutionId: text("institution_id").notNull(),
    status: plaidConnectionStatusEnum("status").default("active").notNull(),
    lastSyncedAt: timestamp("last_synced_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("plaid_connections_item_idx").on(table.plaidItemId),
    index("plaid_connections_practice_idx").on(table.practiceId),
  ]
);

export const plaidAccounts = pgTable(
  "plaid_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    practiceId: uuid("practice_id")
      .references(() => practices.id, { onDelete: "cascade" })
      .notNull(),
    plaidConnectionId: uuid("plaid_connection_id")
      .references(() => plaidConnections.id, { onDelete: "cascade" })
      .notNull(),
    plaidAccountId: text("plaid_account_id").notNull(),
    name: text("name").notNull(),
    officialName: text("official_name"),
    type: text("type").notNull(), // depository, investment, loan, credit
    subtype: text("subtype"), // checking, savings, 401k, mortgage
    currentBalance: numeric("current_balance", { precision: 14, scale: 2 }).notNull(),
    availableBalance: numeric("available_balance", { precision: 14, scale: 2 }),
    currency: text("currency").default("USD").notNull(),
    isIncludedInNetWorth: boolean("is_included_in_net_worth").default(true).notNull(),
    lastBalanceUpdate: timestamp("last_balance_update"),
  },
  (table) => [
    uniqueIndex("plaid_accounts_account_id_idx").on(
      table.plaidConnectionId,
      table.plaidAccountId
    ),
    index("plaid_accounts_practice_idx").on(table.practiceId),
  ]
);

export const netWorthSnapshots = pgTable(
  "net_worth_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    practiceId: uuid("practice_id")
      .references(() => practices.id, { onDelete: "cascade" })
      .notNull(),
    snapshotDate: date("snapshot_date").notNull(),
    practiceValue: numeric("practice_value", { precision: 14, scale: 2 }),
    realEstateValue: numeric("real_estate_value", { precision: 14, scale: 2 }),
    investmentValue: numeric("investment_value", { precision: 14, scale: 2 }),
    retirementValue: numeric("retirement_value", { precision: 14, scale: 2 }),
    liquidAssets: numeric("liquid_assets", { precision: 14, scale: 2 }),
    totalLiabilities: numeric("total_liabilities", { precision: 14, scale: 2 }),
    netWorth: numeric("net_worth", { precision: 14, scale: 2 }),
    computedAt: timestamp("computed_at").defaultNow().notNull(),
  },
  (table) => [
    index("net_worth_snapshots_practice_idx").on(table.practiceId),
    index("net_worth_snapshots_date_idx").on(table.practiceId, table.snapshotDate),
  ]
);

// Phase 5: Loans table — detected or manually entered
export const loans = pgTable(
  "loans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    practiceId: uuid("practice_id")
      .references(() => practices.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    lender: text("lender"),
    originalAmount: numeric("original_amount", { precision: 14, scale: 2 }),
    currentBalance: numeric("current_balance", { precision: 14, scale: 2 }),
    interestRate: numeric("interest_rate", { precision: 5, scale: 4 }),
    monthlyPayment: numeric("monthly_payment", { precision: 12, scale: 2 }),
    remainingMonths: integer("remaining_months"),
    loanType: text("loan_type").notNull(),
    startDate: date("start_date"),
    maturityDate: date("maturity_date"),
    isAutoDetected: boolean("is_auto_detected").default(false).notNull(),
    matchedTransactionPattern: text("matched_transaction_pattern"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("loans_practice_idx").on(table.practiceId)]
);

// Phase 5: Tax alerts
export const taxAlerts = pgTable(
  "tax_alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    practiceId: uuid("practice_id")
      .references(() => practices.id, { onDelete: "cascade" })
      .notNull(),
    alertType: text("alert_type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    priority: text("priority").notNull(),
    actionUrl: text("action_url"),
    taxYear: integer("tax_year").notNull(),
    isDismissed: boolean("is_dismissed").default(false).notNull(),
    dismissedAt: timestamp("dismissed_at"),
    expiresAt: timestamp("expires_at"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("tax_alerts_practice_year_idx").on(table.practiceId, table.taxYear),
  ]
);

// Phase 5: Valuation snapshots — tracked quarterly
export const valuationSnapshots = pgTable(
  "valuation_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    practiceId: uuid("practice_id")
      .references(() => practices.id, { onDelete: "cascade" })
      .notNull(),
    snapshotDate: date("snapshot_date").notNull(),
    revenueMultipleValue: numeric("revenue_multiple_value", {
      precision: 14,
      scale: 2,
    }),
    ebitdaMultipleValue: numeric("ebitda_multiple_value", {
      precision: 14,
      scale: 2,
    }),
    sdeMultipleValue: numeric("sde_multiple_value", {
      precision: 14,
      scale: 2,
    }),
    revenueMultiplier: numeric("revenue_multiplier", {
      precision: 5,
      scale: 2,
    }),
    ebitdaMultiplier: numeric("ebitda_multiplier", {
      precision: 5,
      scale: 2,
    }),
    sdeMultiplier: numeric("sde_multiplier", { precision: 5, scale: 2 }),
    annualRevenue: numeric("annual_revenue", { precision: 14, scale: 2 }),
    ebitda: numeric("ebitda", { precision: 14, scale: 2 }),
    sde: numeric("sde", { precision: 14, scale: 2 }),
    computedAt: timestamp("computed_at").defaultNow().notNull(),
  },
  (table) => [
    index("valuation_snapshots_practice_idx").on(
      table.practiceId,
      table.snapshotDate
    ),
  ]
);

// Phase 5: ROI analyses — saved deal comparisons
export const roiAnalyses = pgTable(
  "roi_analyses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    practiceId: uuid("practice_id")
      .references(() => practices.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    dealType: text("deal_type").notNull(),
    inputs: jsonb("inputs").notNull(),
    results: jsonb("results").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("roi_analyses_practice_idx").on(table.practiceId)]
);

// Phase 5: QBO account mappings for write-back
export const qboAccountMappings = pgTable(
  "qbo_account_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    practiceId: uuid("practice_id")
      .references(() => practices.id, { onDelete: "cascade" })
      .notNull(),
    ourCategory: text("our_category").notNull(),
    qboAccountId: text("qbo_account_id").notNull(),
    qboAccountName: text("qbo_account_name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("qbo_account_mappings_practice_category_idx").on(
      table.practiceId,
      table.ourCategory
    ),
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
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
export type FinancialSnapshot = typeof financialSnapshots.$inferSelect;
export type NewFinancialSnapshot = typeof financialSnapshots.$inferInsert;
export type UserPractice = typeof userPractices.$inferSelect;
export type NewUserPractice = typeof userPractices.$inferInsert;
export type IndustryConfigRow = typeof industryConfigs.$inferSelect;
export type PlaidConnection = typeof plaidConnections.$inferSelect;
export type PlaidAccount = typeof plaidAccounts.$inferSelect;
export type NetWorthSnapshot = typeof netWorthSnapshots.$inferSelect;
export type Loan = typeof loans.$inferSelect;
export type NewLoan = typeof loans.$inferInsert;
export type TaxAlert = typeof taxAlerts.$inferSelect;
export type NewTaxAlert = typeof taxAlerts.$inferInsert;
export type ValuationSnapshot = typeof valuationSnapshots.$inferSelect;
export type RoiAnalysis = typeof roiAnalyses.$inferSelect;
export type NewRoiAnalysis = typeof roiAnalyses.$inferInsert;
export type QboAccountMapping = typeof qboAccountMappings.$inferSelect;
