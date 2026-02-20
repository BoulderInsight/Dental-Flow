# CLAUDE.md

This file provides guidance to Claude Code when working with this repository. Read fully before making changes.

## Project Overview

DentalFlow Pro is a **multi-tenant personal CFO platform** that started for dental practices and now supports any small business running on QuickBooks Online. It automatically categorizes mixed business/personal transactions using an industry-aware rule engine, provides true profitability reports, free cash flow tracking, budget management, Holt-Winters cash flow forecasting, scenario modeling, net worth tracking via Plaid, and multi-practice management with role-based access.

Phases 1–4 are complete. Phase 5 adds advanced financial advisory features: debt capacity modeling, business valuation, tax strategy alerts, ROI calculator, and QBO write-back.

## Commands

- `npm run dev` — Start Next.js dev server with Turbopack
- `npm run build` — Production build
- `npm run start` — Start production server
- `npm run lint` — Run ESLint
- `npm run db:generate` — Generate Drizzle migrations
- `npm run db:migrate` — Run Drizzle migrations
- `npm run db:push` — Push schema to database (dev convenience)
- `npm run db:seed` — Seed database with test data (18 months, industry-aware seasonality)
- `npm run db:studio` — Open Drizzle Studio

## Tech Stack

- **Frontend:** React 19, TypeScript, Next.js 15 (App Router, Turbopack)
- **Styling:** Tailwind CSS + shadcn/ui + Lucide icons
- **Data fetching:** TanStack Query v5 + TanStack Table v8
- **State:** Zustand v5 (with persist middleware)
- **Charts:** Recharts
- **ORM:** Drizzle ORM + PostgreSQL 16
- **Auth:** NextAuth v5 (Auth.js) with credentials provider, JWT sessions
- **QBO SDK:** intuit-oauth v4
- **Plaid SDK:** plaid + react-plaid-link
- **AI:** @anthropic-ai/sdk (industry config generation)
- **PDF:** jspdf + jspdf-autotable
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
    page.tsx                          # Live dashboard: stats, cash flow, financial health, accountant banner
    review/page.tsx                   # Transaction review: keyboard shortcuts, batch mode, detail panel
    transactions/page.tsx             # Full transaction list: filters, sort, CSV export
    finance/page.tsx                  # Financial intelligence: P&L, cash flow, forecast, insights
    finance/budget/page.tsx           # Budget builder: auto-populate, targets, budget vs actual
    finance/scenarios/page.tsx        # Scenario modeling: revenue/expense/debt adjustments
    finance/net-worth/page.tsx        # Net worth: Plaid accounts, manual entries, asset/liability breakdown
    forecast/page.tsx                 # Forecast: Holt-Winters with confidence bands
    settings/rules/page.tsx           # User rule management (CRUD)
    settings/industry/page.tsx        # Industry config: vendors, seasonality, benchmarks
    settings/accounts/page.tsx        # Connected accounts: QBO + Plaid institutions
    settings/practices/new/page.tsx   # Create new practice
    settings/practices/members/page.tsx # Practice members + invite
    architecture/page.tsx             # Architecture visualization
  (auth)/                             # Unauthenticated route group
    layout.tsx                        # Centered layout
    login/page.tsx                    # Email/password login
    signup/page.tsx                   # Signup + practice creation + industry selection
  api/
    auth/[...nextauth]/               # NextAuth route handler
    auth/signup/                      # POST: create user + practice + user_practices
    auth/switch-practice/             # POST: switch active practice in JWT
    dashboard/                        # GET: transaction stats, monthly cash flow, top categories
    qbo/connect|callback|status|sync|webhook/  # QBO OAuth + sync
    transactions/                     # GET: paginated, SQL-level filtered
    transactions/[id]/history/        # GET: categorization history
    categorize/                       # POST: run rule engine
    categorize/[id]/                  # PUT: manual categorize (append-only)
    categorize/batch/                 # POST: batch categorize
    rules/ + rules/[id]/              # CRUD: user rules
    finance/profitability/            # GET: P&L report
    finance/cash-flow/                # GET: free cash flow
    finance/forecast/                 # GET: Holt-Winters projection
    finance/budget/                   # GET/PUT: budget targets + vs actual
    finance/scenario/                 # POST: scenario comparison
    finance/snapshot/ + refresh/      # GET/POST: cached financial metrics
    finance/net-worth/ + manual/ + snapshot/  # GET/PUT: net worth
    export/report/                    # GET: CSV + PDF export
    industry/generate/                # POST: AI-generate IndustryConfig
    industry/config/                  # GET/PUT: industry config for practice
    plaid/link-token|exchange|sync|accounts|connections/  # Plaid OAuth + sync
    practices/ + [id]/invite|members/ # Multi-practice management
components/
  ui/                                 # shadcn/ui primitives
  layout/sidebar.tsx                  # Collapsible sidebar: role-filtered nav items
  layout/practice-switcher.tsx        # Multi-practice dropdown in sidebar header
  dashboard/                          # Cash flow chart, top categories, quick actions
  finance/                            # Metric cards, profitability chart, cash flow area chart, forecast chart, insights
  review/                             # Review panel, table, detail, category actions (permission-aware), shortcuts, batch bar
  transactions/                       # Transaction list table, filters, export button
  plaid/                              # Plaid Link button
  qbo/                                # Connect button, sync status
lib/
  auth/config.ts                      # NextAuth: credentials, JWT callbacks (reads user_practices)
  auth/session.ts                     # getSessionOrDemo() + verifyPracticeMembership()
  auth/permissions.ts                 # canPerform(), requireRole() — owner/manager/accountant
  audit/logger.ts                     # logAuditEvent() — append-only, never fails main flow
  encryption/index.ts                 # Shared AES-256-GCM (used by QBO + Plaid)
  industries/                         # types.ts (IndustryConfig), index.ts (registry), dental/chiropractic/veterinary/general configs
  finance/profitability.ts            # P&L engine
  finance/cash-flow.ts                # Free cash flow engine (uses industry config for patterns)
  finance/forecast.ts                 # Holt-Winters (uses industry config for seasonality)
  finance/budget.ts                   # Budget targets + vs actual
  finance/scenario.ts                 # Scenario comparison engine
  finance/insights.ts                 # Template-driven insights (uses industry benchmarks)
  finance/snapshot.ts                 # Financial snapshot cache (24hr staleness)
  finance/net-worth.ts                # Net worth from Plaid + manual entries
  export/pdf-report.ts               # Monthly PDF report generation (jspdf)
  db/schema.ts                        # Full Drizzle schema (see Database Schema section)
  db/seed.ts                          # 18 months seasonal transactions
  db/index.ts                         # DB connection
  qbo/                                # client, encryption (re-exports shared), token-manager, sync, demo-mode
  plaid/client.ts                     # Plaid client: link token, exchange, accounts
  categorization/                     # account-mapping, vendors, rules (all IndustryConfig-aware), engine
  hooks/use-keyboard-shortcuts.ts     # B/P/A/J/K/R/? keyboard handler
  hooks/use-permissions.ts            # usePermissions() — canWrite, canAdmin, role
  store/                              # review-store, feedback-store, transactions-store (Zustand)
  utils.ts                            # cn() for Tailwind class merging
middleware.ts                         # Auth redirect + demo bypass
```

## System Design Decisions (Authoritative)

Do not deviate without explicit approval.

### Multi-Tenancy

Multi-tenant SaaS. All data isolated by `practice_id`:
- Every data table has `practice_id` FK
- `user_practices` join table: users can belong to multiple practices with different roles
- QBO and Plaid connections per-practice
- Industry configs per-practice (with system-level defaults)
- Auth roles: owner (full access), manager (read+write), accountant (read-only)
- `getSessionOrDemo()` resolves practice context from JWT for all API routes

### QuickBooks Online Integration

- Intuit OAuth 2.0 with AES-256-GCM token encryption ✓
- Proactive refresh at 50-min mark ✓
- Full sync + webhook incremental + deduplication ✓
- **READ-ONLY through Phase 4. Phase 5 adds write-back.**

### Multi-Industry Support (Phase 4)

- `IndustryConfig` interface: vendors, seasonality, benchmarks, account mappings, debt/draw patterns
- Curated configs: dental, chiropractic, veterinary, general
- AI generation for unknown industries via Anthropic Claude API
- Stored in `industry_configs` table, loaded by `getConfigForPractice()`
- All financial engines load config dynamically

### Role-Based Access (Phase 4)

- `lib/auth/permissions.ts`: owner (read+write+admin), manager (read+write), accountant (read)
- All write API endpoints call `requireRole(session, 'write')`
- UI: `usePermissions()` hook hides/disables write actions for accountants
- Sidebar: `requireWrite` flag per nav item, filtered client-side

### Database Schema (PostgreSQL 16)

Tables: practices, users, user_practices, accounts, sessions, verification_tokens, transactions, categorizations (append-only), user_rules, review_sessions, forecasts, audit_log, budgets, financial_snapshots, industry_configs, plaid_connections, plaid_accounts, net_worth_snapshots.

### Product Vision — Remaining Features

Phase 5: Debt Capacity Model, Cost of Capital Review, Business Valuation, Tax Strategy Alerts, Investment ROI Calculator, QBO Write-back
Phase 6: Retirement Planning, Referral Marketplace

## Implementation Phases

- **Phase 1 (COMPLETE):** Next.js, Drizzle, QBO OAuth + sync, rule engine, review UI, seed data
- **Phase 2 (COMPLETE):** Auth, dashboard, keyboard shortcuts, batch mode, QBO account mapping, feedback loop, audit logging
- **Phase 3 (COMPLETE):** P&L, free cash flow, Holt-Winters forecast, budget builder, scenario modeling, snapshot caching, insights, CSV export
- **Phase 4 (COMPLETE):** Multi-industry config (AI-generated), multi-practice management, accountant portal, Plaid integration, net worth tracking, PDF export
- **Phase 5 (CURRENT):** Debt capacity model, cost of capital dashboard, business valuation, tax strategy alerts, ROI calculator, QBO write-back, tech debt fixes
- **Phase 6:** Retirement planning, referral marketplace, partner integrations

## Known Technical Debt (see TECHNICAL_DEBT.md)

1. `profitability.ts` doesn't load industry config for overhead benchmarks
2. `POST /api/finance/scenario` missing `requireRole()` check
3. Legacy `users.practiceId` fallback in auth config
4. Branding still says "DentalFlow" in sidebar, exports, PDF
5. Email invites stored but not sent
6. PDF export filename hardcoded

## Code Style & Patterns

- TypeScript throughout — no .js/.jsx
- `getSessionOrDemo()` first in every API route, return 401 if null
- `requireRole(session, 'write')` on all write endpoints
- `logAuditEvent()` for state-changing operations
- Error shape: `{ error: string }` with HTTP status
- New tables: always include `practice_id` FK + indexes
- Latest categorization: correlated subquery `ORDER BY created_at DESC LIMIT 1`
- Financial math: all in `lib/finance/` (server-side), money as `numeric(12,2)` → `parseFloat()`
- Industry config: `getConfigForPractice(practiceId)` for any industry-specific behavior
- Charts: Recharts with ResponsiveContainer
- Route groups: `(app)` authenticated + sidebar, `(auth)` unauthenticated + minimal
- Role awareness: `usePermissions()` hook for client-side, `requireRole()` for API
- **IMPORTANT: All financial advisory content must include disclaimer: "This is not financial advice. Consult your CPA/financial advisor."**
