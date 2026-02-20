# CLAUDE.md

This file provides guidance to Claude Code when working with this repository. Read fully before making changes.

## Project Overview

DentalFlow Pro is a **multi-tenant personal CFO platform** initially built for dental practices but expanding to serve any small business that runs on QuickBooks Online. It automatically categorizes mixed business/personal transactions, provides true profitability reports, free cash flow tracking, budget management, cash flow forecasting with Holt-Winters, and scenario modeling.

Phases 1–3 are complete. The application has QBO integration, a layered categorization engine, authentication, a live dashboard, keyboard-driven transaction review with batch mode, audit logging, full financial intelligence (P&L, free cash flow, forecasting, budget builder, scenario modeling), and CSV export.

## Commands

- `npm run dev` — Start Next.js dev server with Turbopack
- `npm run build` — Production build
- `npm run start` — Start production server
- `npm run lint` — Run ESLint
- `npm run db:generate` — Generate Drizzle migrations
- `npm run db:migrate` — Run Drizzle migrations
- `npm run db:push` — Push schema to database (dev convenience)
- `npm run db:seed` — Seed database with test data (18 months, dental seasonality)
- `npm run db:studio` — Open Drizzle Studio

## Tech Stack

- **Frontend:** React 19, TypeScript, Next.js 15 (App Router, Turbopack)
- **Styling:** Tailwind CSS + shadcn/ui + Lucide icons
- **Data fetching:** TanStack Query v5 + TanStack Table v8
- **State:** Zustand v5 (with persist middleware for feedback tracking)
- **Charts:** Recharts
- **ORM:** Drizzle ORM + PostgreSQL 16
- **Auth:** NextAuth v5 (Auth.js) with credentials provider, JWT sessions
- **QBO SDK:** intuit-oauth v4
- **Validation:** Zod v4
- **Toasts:** Sonner
- **Cache/Queue:** Redis (ioredis)
- **Local infra:** Docker Compose (Postgres + Redis)

## Code Structure

```
app/
  layout.tsx                          # Root layout with providers
  providers.tsx                       # TanStack Query + Sonner toaster
  globals.css                         # Tailwind globals
  (app)/                              # Authenticated route group (sidebar layout)
    layout.tsx                        # Sidebar wrapper
    page.tsx                          # Live dashboard: stats, cash flow chart, top categories, financial health
    review/page.tsx                   # Transaction review: keyboard shortcuts, batch mode, detail panel
    transactions/page.tsx             # Full transaction list: filters, sort, CSV export
    finance/page.tsx                  # Financial intelligence: P&L, cash flow, forecast charts, insights
    finance/budget/page.tsx           # Budget builder: auto-populate, targets, budget vs actual
    finance/scenarios/page.tsx        # Scenario modeling: revenue slider, add/remove expenses, comparison
    forecast/page.tsx                 # Forecast: Holt-Winters chart with confidence bands, seasonality
    settings/rules/page.tsx           # User rule management (CRUD)
    architecture/page.tsx             # Architecture visualization
  (auth)/                             # Unauthenticated route group (minimal layout)
    layout.tsx                        # Centered layout
    login/page.tsx                    # Email/password login
    signup/page.tsx                   # Signup + practice creation
  api/
    auth/[...nextauth]/               # NextAuth route handler
    auth/signup/                      # POST: create user + practice
    dashboard/                        # GET: transaction stats, monthly cash flow, top categories
    qbo/connect/                      # GET: initiate QBO OAuth
    qbo/callback/                     # GET: OAuth callback, store encrypted tokens
    qbo/status/                       # GET: connection status
    qbo/sync/                         # POST: trigger full transaction sync
    qbo/webhook/                      # POST: QBO webhook receiver
    transactions/                     # GET: paginated, filtered (SQL-level), sorted
    transactions/[id]/history/        # GET: categorization history
    categorize/                       # POST: run rule engine on uncategorized
    categorize/[id]/                  # PUT: manual categorize (append-only)
    categorize/batch/                 # POST: batch categorize
    rules/                            # GET/POST: user rules
    rules/[id]/                       # PUT/DELETE: individual rule
    finance/profitability/            # GET: P&L report with monthly breakdown
    finance/cash-flow/                # GET: business/personal/combined free cash
    finance/forecast/                 # GET: Holt-Winters 6-month projection
    finance/budget/                   # GET/PUT: budget targets and vs actual
    finance/scenario/                 # POST: scenario comparison
    finance/snapshot/                 # GET: cached financial metrics
    finance/snapshot/refresh/         # POST: force recompute
    export/report/                    # GET: CSV export (profitability, cashflow, budget)
components/
  ui/                                 # shadcn/ui primitives
  layout/sidebar.tsx                  # Collapsible sidebar: Dashboard, Transactions, Review, Financials, Forecast, Rules
  dashboard/                          # Cash flow chart, top categories, quick actions
  finance/                            # Metric cards, profitability chart, cash flow area chart, forecast chart, insights panel
  review/                             # Review panel, transaction table (checkboxes), detail (history), category actions
                                      # (feedback tracking), filters, shortcut bar, batch action bar
  transactions/                       # Transaction list table, filters, CSV export button
  qbo/                                # Connect button, sync status
lib/
  auth/config.ts                      # NextAuth: credentials provider, JWT callbacks (practiceId, role in token)
  auth/session.ts                     # getSessionOrDemo() — real or demo session
  audit/logger.ts                     # logAuditEvent() — append-only, never fails main flow
  finance/profitability.ts            # P&L: revenue/expense by accountRef, overhead ratio, monthly breakdown
  finance/cash-flow.ts                # Free cash flow: business, personal, combined, debt service, rolling averages
  finance/forecast.ts                 # Holt-Winters triple exponential smoothing, dental seasonality, confidence bands
  finance/budget.ts                   # Budget targets, auto-suggest from trailing 3mo, budget vs actual
  finance/scenario.ts                 # Scenario engine: revenue/expense/debt adjustments, base vs scenario comparison
  finance/insights.ts                 # Programmatic insights from financial metrics (template-driven, no LLM)
  finance/snapshot.ts                 # Financial snapshot cache (24hr staleness, refresh on demand)
  db/schema.ts                        # Full Drizzle schema (see Database Schema section)
  db/seed.ts                          # 18 months of realistic transactions: revenue ($45K–$52K/mo), expenses,
                                      # owner's draws ($15K/mo), loan payments, dental seasonality baked in
  db/index.ts                         # DB connection
  qbo/                                # client, encryption, token-manager, sync, demo-mode
  categorization/account-mapping.ts   # QBO account → business/personal/ambiguous (21 business, 6 personal, 10 ambiguous)
  categorization/vendors.ts           # Curated dental vendor lists
  categorization/rules.ts             # Layered engine: user rules → QBO accounts → vendors → patterns → ambiguous
  categorization/engine.ts            # Orchestrator: runs rules on uncategorized transactions
  hooks/use-keyboard-shortcuts.ts     # B/P/A/J/K/R/? keyboard handler
  store/                              # review-store, feedback-store, transactions-store (Zustand)
  utils.ts                            # cn() for Tailwind class merging
middleware.ts                         # Auth: redirect to /login, demo mode bypass, public paths
types/next-auth.d.ts                  # Session extensions (practiceId, role)
types/intuit-oauth.d.ts               # intuit-oauth type declarations
```

## System Design Decisions (Authoritative)

Do not deviate without explicit approval.

### Multi-Tenancy

Multi-tenant SaaS. All data isolated by `practice_id`:
- Every data table has `practice_id` FK
- QBO connections per-practice
- User rules per-practice
- Budgets per-practice per-year
- Auth roles: owner, manager, accountant (read-only)
- `getSessionOrDemo()` resolves practice context for all API routes

### QuickBooks Online Integration

- Intuit OAuth 2.0, scope: `com.intuit.quickbooks.accounting` ✓
- AES-256-GCM encrypted token storage ✓
- Proactive refresh at 50-min mark ✓
- Full sync: 12 months from Purchase, Deposit, Transfer ✓
- Webhook incremental sync ✓
- Deduplication by `qbo_txn_id` per practice ✓
- **READ-ONLY through Phase 4. Write-back deferred to Phase 5+**

### Transaction Categorization — Layered Engine (COMPLETE)

Priority order, first match wins:
1. **User Rules** (100%) — manual corrections or rule builder
2. **QBO Account Mapping** (90–95%) — bookkeeper's existing QBO categorization
3. **Vendor Matching** (85–100%) — curated industry vendor lists (currently dental-specific)
4. **Pattern Matching** (85–95%) — keyword patterns in vendor/description
5. **Ambiguous QBO fallback** (50%) — "Supplies", "Food", "Subscriptions"

User feedback loop: after 2 identical vendor corrections, prompts to create persistent rule.

**Phase 4 change:** Vendor lists and account mappings will be extracted into industry-specific configs (`lib/industries/`). The categorization engine will load the appropriate config based on `practices.industry`.

### Database Schema (PostgreSQL 16)

Current tables:
- `practices` — id, name, qbo_realm_id, qbo_tokens (encrypted), fiscal_year_start, practice_addresses[], reserve_threshold
- `users` — id, practice_id, email, name, password_hash, role (owner|manager|accountant), timestamps
- `accounts`, `sessions`, `verification_tokens` — NextAuth adapter tables
- `transactions` — id, practice_id, qbo_txn_id, date, amount, vendor_name, description, account_ref, raw_json, synced_at
- `categorizations` — id, transaction_id, category, confidence, source, rule_id, reasoning, created_at (APPEND-ONLY)
- `user_rules` — id, practice_id, match_type, match_value, category, priority
- `review_sessions` — id, practice_id, user_id, period_start, period_end, status, completed_at
- `forecasts` — id, practice_id, forecast_date, period_months, method, parameters_json, results_json
- `audit_log` — id, practice_id, user_id, action, entity_type, entity_id, old_value, new_value, created_at
- `budgets` — id, practice_id, year, account_ref, monthly_target, timestamps (unique on practice+year+account)
- `financial_snapshots` — id, practice_id, period_start, period_end, period_type, revenue, operating_expenses, overhead_ratio, net_operating_income, owner_compensation, true_net_profit, business_free_cash, personal_free_cash, combined_free_cash, excess_cash, computed_at

### Financial Intelligence (COMPLETE)

**True Profitability (P&L):** Revenue by accountRef, operating expenses by category, overhead ratio (benchmark 55–65%), owner's compensation, true net profit. Monthly breakdown for 12-month trending.

**Free Cash Flow:** Business (NOI - debt service), personal (draws - personal expenses), combined. Rolling 3mo and 12mo averages. Excess cash = combined - reserve threshold.

**Forecast:** Holt-Winters triple exponential smoothing with dental seasonality indices. 6-month forward projection, 80% and 95% confidence bands. Cash runway and trend metrics. Stored in forecasts table.

**Budget:** Auto-populate from trailing 3-month averages. Budget vs actual with under/on_track/over status. Monthly and YTD views.

**Scenario Modeling:** Revenue %, new expenses, removed expenses, new debt service. Side-by-side base vs scenario with summary text.

**Insights:** Template-driven (no LLM). Overhead status, excess cash / debt capacity hint, runway warning, top expense, trend direction, seasonal dip.

### Product Vision

Transaction categorization is the data ingestion layer. The product is a personal CFO:

1. ~~True Profitability~~ ✓ (Phase 3)
2. ~~Free Cash Flow~~ ✓ (Phase 3)
3. ~~Cash Flow Forecasting~~ ✓ (Phase 3)
4. ~~Budget Builder~~ ✓ (Phase 3)
5. **Multi-Industry Support** (Phase 4 — expanding beyond dental)
6. **Multi-Practice Management** (Phase 4)
7. **Accountant Portal** (Phase 4 — read-only role)
8. **Plaid Integration / Net Worth** (Phase 4)
9. Debt Capacity Model (Phase 5)
10. Business Valuation (Phase 5)
11. Tax Strategies (Phase 5)
12. Retirement Planning (Phase 6)

## Implementation Phases

- **Phase 1 (COMPLETE):** Next.js, Drizzle schema, QBO OAuth + sync, Tier 1 rule engine, review UI, seed data
- **Phase 2 (COMPLETE):** Auth, live dashboard, keyboard shortcuts + batch mode, QBO account mapping, feedback loop, audit logging, SQL filtering, rules management
- **Phase 3 (COMPLETE):** Profitability P&L, free cash flow, Holt-Winters forecast, budget builder, scenario modeling, financial snapshot caching, insights engine, CSV export, 18-month seasonal seed data
- **Phase 4 (CURRENT):** Multi-industry config system (AI-generated for unknown industries), multi-practice management, accountant portal, Plaid integration, net worth tracking, PDF export
- **Phase 5:** Debt capacity model, business valuation, tax strategy alerts, ROI calculator, QBO write-back
- **Phase 6:** Retirement planning, referral marketplace, partner integrations

## Security Requirements

- QBO tokens: AES-256-GCM encrypted at rest ✓
- Auth: NextAuth v5 JWT sessions ✓
- Middleware: auth redirect + demo bypass ✓
- Audit logging: append-only, never fails main flow ✓
- Row-level security scoped to practice_id
- Intuit compliance: delete data within 30 days of disconnection
- TLS 1.3 in production

## Code Style & Patterns

- TypeScript throughout — no .js/.jsx
- Functional components with hooks, default exports for pages
- Components under 200 lines — extract subcomponents
- `getSessionOrDemo()` first in every API route, return 401 if null
- `logAuditEvent()` for all state-changing operations
- Error shape: `{ error: string }` with HTTP status
- New tables: always include `practice_id` FK + indexes
- Latest categorization: correlated subquery `ORDER BY created_at DESC LIMIT 1`
- Batch operations: Zod-validated, single audit log entry
- Financial math: all in `lib/finance/` (server-side only), money as `numeric(12,2)`, parse with `parseFloat()`
- Charts: Recharts with ResponsiveContainer, dark theme
- Route groups: `(app)` authenticated + sidebar, `(auth)` unauthenticated + minimal
- State: Zustand stores in `lib/store/`, persist middleware where client-side persistence needed

## Known Issues

1. **PDF export not implemented** — Export route only supports CSV. Phase 4 should add PDF generation.
2. **Vendor lists are dental-only** — `lib/categorization/vendors.ts` has dental-specific vendors. Phase 4 extracts into industry config system.
3. **Seasonality indices are dental-only** — Forecast uses hardcoded dental seasonality. Phase 4 makes configurable per industry.
4. **Overhead benchmarks are dental-only** — 55–65% target. Different industries have different ranges. Phase 4 makes configurable.
5. **Single practice per user** — Users belong to exactly one practice. Phase 4 adds multi-practice support.
6. **No Plaid integration** — Net worth tracking requires external bank/investment data.
