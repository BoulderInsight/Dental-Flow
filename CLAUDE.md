# CLAUDE.md

This file provides guidance to Claude Code when working with this repository. Read fully before making changes.

## Project Overview

PracticePulse is a **multi-tenant personal CFO platform** for any small business running on QuickBooks Online. It automatically categorizes mixed business/personal transactions using an industry-aware rule engine, provides true profitability reports, free cash flow tracking, budget management, Holt-Winters cash flow forecasting, scenario modeling, net worth tracking via Plaid, multi-practice management with role-based access, debt capacity modeling, business valuation, tax strategy alerts, ROI calculator, QBO write-back, retirement planning with asset acquisition roadmap, referral marketplace with opportunity detection, email notifications, and a CFO Briefing dashboard.

All 6 phases are complete. The platform is feature-complete.

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
- **Email:** Resend (graceful degradation when no API key)
- **Validation:** Zod v4
- **Toasts:** Sonner
- **Cache/Queue:** Redis (ioredis)
- **Local infra:** Docker Compose (Postgres + Redis)

## Code Structure

```
app/
  (app)/                              # Authenticated routes (sidebar layout)
    page.tsx                          # Dashboard: CFO Briefing, onboarding, stats, cash flow
    review/                           # Transaction review: keyboard shortcuts, batch mode
    transactions/                     # Transaction list: filters, CSV export
    finance/                          # Financials: P&L, cash flow, forecast, insights
    finance/budget/                   # Budget builder
    finance/scenarios/                # Scenario modeling
    finance/net-worth/                # Net worth: Plaid + manual entries
    finance/debt-capacity/            # Debt capacity: DSCR, stress tests, borrowing power
    finance/loans/                    # Loan management: auto-detected + manual
    finance/cost-of-capital/          # WACC, refinance detection, payoff acceleration
    finance/valuation/                # Business valuation: revenue/EBITDA/SDE multiples
    finance/tax-strategy/             # Tax alerts: year-end, estimated tax, depreciation
    finance/roi/                      # ROI calculator: real estate, practice, equipment
    finance/retirement/               # Retirement planning: readiness, projections, scenarios
    finance/retirement/roadmap/       # Asset acquisition roadmap: timeline, milestones
    referrals/                        # Referral marketplace: opportunities, partner matching
    forecast/                         # Holt-Winters with confidence bands
    settings/rules/                   # User rule management
    settings/industry/                # Industry config: vendors, seasonality, benchmarks
    settings/accounts/                # Connected accounts: QBO + Plaid
    settings/qbo-sync/                # QBO write-back: mappings, preview, execute
    settings/notifications/           # Email notification preferences
    settings/practices/new/           # Create new practice
    settings/practices/members/       # Practice members + invite
  (auth)/                             # Unauthenticated routes
    login/ + signup/                  # Auth pages (signup includes industry selection)
  api/                                # All API routes (see API section below)
components/
  ui/                                 # shadcn/ui primitives + advisory-disclaimer
  layout/sidebar.tsx                  # 5-section sidebar with notification badges
  layout/practice-switcher.tsx        # Multi-practice dropdown
  dashboard/                          # Cash flow chart, top categories, quick actions
  review/                             # Permission-aware review components
  plaid/ + qbo/                       # Integration components
lib/
  auth/                               # config, session, permissions
  audit/                              # Append-only audit logger
  config/                             # branding (APP_NAME, export filenames)
  email/                              # client (Resend), templates (invite, alert, digest)
  encryption/                         # Shared AES-256-GCM
  industries/                         # IndustryConfig types, registry, 4 curated configs
  finance/                            # profitability, cash-flow, forecast, budget, scenario, insights, snapshot, net-worth, debt-capacity, cost-of-capital, loans, valuation, tax-strategy, roi-calculator, retirement, retirement-roadmap, cfo-briefing
  export/                             # PDF report generation
  db/                                 # schema, seed, connection
  onboarding/                         # Setup checklist (query-based detection)
  qbo/                                # client, encryption, token-manager, sync, write-back, account-mapping-config
  plaid/                              # client (link token, exchange, accounts)
  referrals/                          # opportunity-detector, partners
  categorization/                     # account-mapping, vendors, rules, engine (all IndustryConfig-aware)
  hooks/                              # use-keyboard-shortcuts, use-permissions
  store/                              # Zustand: review-store, feedback-store, transactions-store
```

## Key API Routes

**Auth:** signup, switch-practice, [...nextauth]
**QBO:** connect, callback, status, sync, webhook, accounts, account-mappings, write-back (preview/execute/history)
**Plaid:** link-token, exchange, sync, accounts, connections
**Transactions:** list (paginated, filtered), history, categorize (single/batch), rules CRUD
**Finance:** profitability, cash-flow, forecast, budget, scenario, snapshot, net-worth, debt-capacity, cost-of-capital, loans (CRUD + detect), valuation (+ snapshot + history), tax-alerts (+ generate + dismiss), roi (calculate + analyses CRUD), retirement (projection + profile + roadmap + milestones CRUD)
**Referrals:** opportunities (list + detect + status update), partners, refer, history
**Notifications:** preferences (GET/PUT), send-digest, send-weekly
**Dashboard:** briefing (CFO Briefing data)
**Onboarding:** checklist
**Practices:** list, create, invite (with email), members
**Industry:** config, generate (AI)
**Export:** report (CSV + PDF)

## System Design Decisions

### Multi-Tenancy
All data isolated by `practice_id`. `user_practices` join table supports many-to-many with roles.

### Roles
Owner (full access), Manager (read+write), Accountant (read-only). `requireRole()` on write endpoints, `usePermissions()` hook for UI.

### Multi-Industry
`IndustryConfig` interface with vendors, seasonality, benchmarks, valuationMultipliers, taxDefaults. Curated: dental, chiropractic, veterinary, general. AI generation for unknown industries via Anthropic API.

### Financial Advisory
All advisory pages include `AdvisoryDisclaimer` component. All financial calculations server-side in `lib/finance/`. Money stored as `numeric(12,2)` or `numeric(14,2)`.

### QBO Integration
Read + Write. AES-256-GCM encrypted tokens. SyncToken-based updates. 200ms throttle on batch writes. Admin-only for write-back.

### Email Notifications
Resend SDK with graceful degradation (log-only when no `RESEND_API_KEY`). Templates use inline CSS for email client compatibility. User-level notification preferences with per-type toggles.

### Referral Marketplace
7-type opportunity detection engine scans financial data for actionable opportunities (refinance, insurance, tax planning, exit planning, equipment, financial advisor, debt consolidation). Partners matched by category + industry + region. Referral tracking with status lifecycle.

### Retirement Planning
4% rule with inflation-adjusted projections. Compound growth formula with monthly contributions. Year-by-year projection through retirement. Three scenarios: current pace, accelerated savings, with practice sale (70% of valuation net of taxes). Roadmap suggestions based on excess cash, debt payoff timeline, and practice valuation.

### Database Schema (PostgreSQL 16)
Tables: practices, users, user_practices, accounts, sessions, verification_tokens, transactions, categorizations (append-only), user_rules, review_sessions, forecasts, audit_log, budgets, financial_snapshots, industry_configs, plaid_connections, plaid_accounts, net_worth_snapshots, loans, tax_alerts, valuation_snapshots, roi_analyses, qbo_account_mappings, retirement_profiles, retirement_milestones, referral_partners, referral_opportunities, notification_preferences.

## Implementation Phases

- **Phase 1 (COMPLETE):** Next.js, Drizzle, QBO OAuth + sync, rule engine, review UI, seed data
- **Phase 2 (COMPLETE):** Auth, dashboard, keyboard shortcuts, batch mode, QBO account mapping, feedback loop, audit logging
- **Phase 3 (COMPLETE):** P&L, free cash flow, Holt-Winters forecast, budget builder, scenario modeling, insights, CSV export
- **Phase 4 (COMPLETE):** Multi-industry config, multi-practice, accountant portal, Plaid, net worth, PDF export
- **Phase 5 (COMPLETE):** Debt capacity, cost of capital, business valuation, tax strategy, ROI calculator, QBO write-back
- **Phase 6 (COMPLETE):** Retirement planning, referral marketplace, email notifications, dashboard intelligence (CFO Briefing), onboarding checklist, platform polish (PracticePulse branding)

## Deployment & Operations

Cron jobs needed for production:
- **Monthly digest:** `POST /api/notifications/send-digest` — 1st of each month
- **Weekly insights:** `POST /api/notifications/send-weekly` — Monday mornings
- **Opportunity detection:** `POST /api/referrals/opportunities/detect` — weekly or on data changes

## Code Style & Patterns

- TypeScript throughout — no .js/.jsx
- `getSessionOrDemo()` first in every API route, return 401 if null
- `requireRole(session, 'write')` on all write endpoints, `'admin'` for destructive ops
- `logAuditEvent()` for state-changing operations
- Error shape: `{ error: string }` with HTTP status
- New tables: always include `practice_id` FK + indexes
- Financial math in `lib/finance/`, money as `numeric` → `parseFloat()`
- Industry config: `getConfigForPractice(practiceId)` for industry-specific behavior
- Charts: Recharts with ResponsiveContainer
- Route groups: `(app)` authenticated + sidebar, `(auth)` unauthenticated
- Branding: use `APP_NAME` from `lib/config/branding.ts` — never hardcode app name
- **All financial advisory content: include AdvisoryDisclaimer component**
