# CLAUDE.md

This file provides guidance to Claude Code when working with this repository. Read fully before making changes.

## Project Overview

DentalFlow Pro is a **multi-tenant personal CFO platform for dental practices** — not just a bookkeeping tool. It integrates with QuickBooks Online, automatically categorizes mixed business/personal transactions, and provides financial intelligence including cash flow forecasting, net worth tracking, debt capacity modeling, and tax strategy insights.

Phase 1 is complete. The application is a Next.js 15 + TypeScript app with a working QBO OAuth integration, Tier 1 rule engine, seed data, and a transaction review UI.

## Commands

- `npm run dev` — Start Next.js dev server with Turbopack
- `npm run build` — Production build
- `npm run start` — Start production server
- `npm run lint` — Run ESLint
- `npm run db:generate` — Generate Drizzle migrations
- `npm run db:migrate` — Run Drizzle migrations
- `npm run db:push` — Push schema to database (dev convenience)
- `npm run db:seed` — Seed database with test data
- `npm run db:studio` — Open Drizzle Studio

## Tech Stack

- **Frontend:** React 19, TypeScript, Next.js 15 (App Router, Turbopack)
- **Styling:** Tailwind CSS + shadcn/ui + Lucide icons
- **Data fetching:** TanStack Query v5 + TanStack Table v8
- **State:** Zustand v5
- **Charts:** Recharts
- **ORM:** Drizzle ORM + PostgreSQL 16
- **QBO SDK:** intuit-oauth v4
- **Cache/Queue:** Redis (ioredis)
- **Local infra:** Docker Compose (Postgres + Redis)

## Code Structure

```
app/                          # Next.js App Router
  layout.tsx                  # Root layout: sidebar + providers
  page.tsx                    # Dashboard (placeholder — needs Phase 2 work)
  providers.tsx               # TanStack Query provider
  api/
    qbo/connect/              # QBO OAuth initiation
    qbo/callback/             # QBO OAuth callback + token storage
    qbo/status/               # Connection status check
    qbo/sync/                 # Full transaction sync trigger
    qbo/webhook/              # Webhook receiver for incremental sync
    transactions/             # GET: paginated, filtered transaction list
    categorize/               # POST: run Tier 1 engine on uncategorized txns
    categorize/[id]/          # PUT: user manual recategorization
  review/                     # Review UI page
  transactions/               # Transactions list page (placeholder)
  forecast/                   # Forecast page (placeholder)
  architecture/               # Architecture visualization (preserved from v0)
components/
  ui/                         # shadcn/ui primitives (button, card, badge, etc.)
  layout/sidebar.tsx          # Collapsible sidebar nav
  review/                     # Review panel, table, detail, filters, actions, progress
  qbo/                        # QBO connection UI components
lib/
  db/schema.ts                # Drizzle schema (practices, transactions, categorizations, user_rules, review_sessions, forecasts)
  db/seed.ts                  # 100 realistic dental transactions
  db/index.ts                 # DB connection
  qbo/client.ts               # Intuit OAuth client, token exchange, API calls
  qbo/encryption.ts           # AES-256-GCM encrypt/decrypt for tokens
  qbo/token-manager.ts        # Store/retrieve tokens with proactive 50-min refresh
  qbo/sync.ts                 # Transaction sync pipeline with deduplication
  qbo/demo-mode.ts            # Demo mode detection
  categorization/vendors.ts   # Curated vendor lists (dental supply, lab, software, payroll, personal, ambiguous)
  categorization/rules.ts     # Tier 1 deterministic rule engine with priority ordering
  categorization/engine.ts    # Orchestrator: runs rules on uncategorized transactions
  store/                      # Zustand stores
  utils.ts                    # cn() utility for Tailwind merging
types/                        # TypeScript type declarations
src/DentalFlow_Architecture.jsx  # Original architecture visualization (preserved)
```

## System Design Decisions (Authoritative)

Do not deviate from these without explicit approval.

### Multi-Tenancy

This is a multi-tenant SaaS product serving many dental practices. All data isolation is scoped to `practice_id`:
- Every data table has a `practice_id` foreign key
- Row-level security policies must be scoped to practice_id
- QBO connections are per-practice (each has its own OAuth tokens + realm_id)
- User rules are per-practice
- Auth must support: practice owner, team members (office managers), and accountant (read-only) roles

### QuickBooks Online Integration

- Intuit OAuth 2.0 authorization code flow, scope: `com.intuit.quickbooks.accounting`
- Uses `intuit-oauth` SDK (already installed)
- Token storage: AES-256-GCM encrypted in PostgreSQL `practices.qbo_tokens` column
- Proactive token refresh at 50-minute mark (tokens expire at 60 min)
- Rolling refresh token rotation (100-day lifetime)
- Initial connect: full sync of last 12 months from Purchase, Deposit, Transfer, Account, Vendor endpoints
- Ongoing: webhook-based incremental sync + daily batch reconciliation
- Phase 1–2: READ-ONLY from QBO. Write-back deferred to Phase 3+
- Deduplicate by `qbo_txn_id` per practice

### Transaction Categorization — Layered Engine

The categorization engine evaluates transactions in strict priority order. First match wins.

**Layer 0: User Rules (highest priority, 100% confidence)**
- User-created rules from manual corrections or the rule builder
- Match on vendor name, description, or amount range
- Scoped to practice_id — each practice has its own rules
- ALREADY IMPLEMENTED in `lib/categorization/rules.ts`

**Layer 1: QBO Account Mapping (90–95% confidence) — NEEDS PHASE 2 WORK**
- If the dentist or bookkeeper already assigned a QBO chart-of-accounts category, respect that decision
- The `accountRef` field is already captured and stored but NOT currently used by the rule engine
- Business accounts (95% confidence): "Lab Fees", "Dental Supplies", "Payroll", "Rent", "Utilities", "Insurance", "Professional", "Education", "Marketing", "Equipment", "Instruments", "Services"
- Personal accounts (90% confidence): "Entertainment", "Fitness", "Personal", "Owner's Draw"
- Ambiguous accounts (flag for review): "Supplies" (could be business or personal), "Food" (team lunch vs personal), "Subscriptions" (practice software vs Netflix), "Office" (practice vs home office)
- The account mapping should be configurable per practice — during onboarding, the doctor maps their QBO chart of accounts to business/personal/ambiguous
- This is a CRITICAL gap: QBO already has categorization data we're ignoring

**Layer 2: Vendor Matching (85–100% confidence) — COMPLETE**
- Hard-coded vendor lists for dental industry
- Known business vendors (100%): Henry Schein, Patterson, Benco, Glidewell, labs, software, payroll
- Known personal (95%): Netflix, Spotify, gyms, meal kits
- Ambiguous retail (40%): Amazon, Walmart, Target — always flagged
- Vendor lists in `lib/categorization/vendors.ts`

**Layer 3: ML Classification (Phase 3 — Python FastAPI microservice)**
- Fine-tuned DistilBERT on labeled dental practice transaction data
- Input features: merchant name, memo/description, QBO account category, amount, day/time
- Temporal pattern detection for recurring charges
- Dental-specific amount heuristics
- Cross-account correlation for transfers

**Layer 4: User Feedback Loop (Phase 2)**
- Every user correction creates a user-specific rule (becomes Layer 0)
- After 2 identical vendor corrections, auto-prompt to create a persistent rule
- Corrections logged with original prediction + context for ML retraining

**Confidence Scoring & Review Flow:**
- 90–100%: Auto-categorized (green) — QBO account was clear, or known vendor match, or user rule. Shown as "accepted" but user can override.
- 70–89%: AI suggestion (yellow) — educated guess from ML or weaker signal. "We think this is Business because [reasoning]." One click to accept or change.
- Below 70%: Needs review (orange/red) — ambiguous vendor, no QBO account signal, low ML confidence. Must categorize manually before included in reports.

**Key principle:** If the categorization comes from QBO (the dentist's own bookkeeper already made the call), that's a 90%+ confidence signal. We're leveraging work that's already been done — not ignoring it.

### Database Schema (PostgreSQL 16)

Core tables — do not rename or restructure without discussion:
- `practices` — id, name, qbo_realm_id, qbo_tokens (encrypted), fiscal_year_start, practice_addresses[]
- `transactions` — id, practice_id, qbo_txn_id, date, amount, vendor_name, description, account_ref, raw_json
- `categorizations` — id, transaction_id, category (business|personal|ambiguous), confidence, source (rule|ml|user), rule_id, reasoning, created_at
- `user_rules` — id, practice_id, match_type (vendor|description|amount_range), match_value, category, priority
- `review_sessions` — id, practice_id, user_id, period_start, period_end, status (in_progress|completed), completed_at
- `forecasts` — id, practice_id, forecast_date, period_months, method, parameters_json, results_json

**Tables to add in Phase 2:** `users` (id, practice_id, email, name, role, created_at), `audit_log` (id, practice_id, user_id, action, entity_type, entity_id, old_value, new_value, created_at)

### What Doctors Actually Want (Product Vision)

Transaction categorization is the data ingestion layer — NOT the product. The product is a personal CFO. Key features by priority:

1. **True Profitability** — Separate business vs personal to show real practice P&L and overhead ratio
2. **Free Cash Flow** — Business free cash, personal free cash, combined — updated monthly automatically
3. **Debt Capacity Model** — "Can I afford to buy that building?" with DSCR calculations and stress testing
4. **Combined Net Worth** — Practice value + real estate + investments + retirement - all liabilities (requires Plaid integration in Phase 4+)
5. **Cost of Capital Review** — All loans dashboard, refinance opportunity detection, payoff acceleration modeling
6. **Tax Strategies** — Year-end planning alerts, cost segregation on real estate, bonus depreciation tracking (advisory only — always disclaim "consult your CPA")
7. **Business Valuation** — Collections multiple estimate, EBITDA method, trend tracking, vendor cost benchmarking
8. **Retirement Planning** — Passive income gap analysis, asset acquisition roadmap
9. **Investment ROI** — Deal analyzer for rental properties, compare ROI across investment types
10. **Referral Marketplace** — Detect refinance/insurance review opportunities → partner referrals (revenue model)

### Cash Flow Forecasting

- Operates ONLY on confirmed business-classified transactions
- Primary model: Holt-Winters triple exponential smoothing
- Dental seasonality: summer dip (Jun–Aug), year-end insurance rush (Nov–Dec), January benefit reset
- Key metrics: Net Operating Cash Flow, Cash Runway, Overhead Ratio (benchmark 55–65%), DSCR, Confidence Intervals (80% + 95%)
- Scenario modeling: "What if I hire an associate?" / "What if production drops 15%?"

### Review Interface — UX Requirements

This is the most critical screen. Design for speed:
- Split-panel: transaction list (left) + detail (right)
- Default sort: lowest confidence first
- Keyboard shortcuts (Phase 2): B = Business, P = Personal, S = Split, R = Create Rule, Arrow Down = Next
- Batch mode (Phase 2): select multiple same-vendor transactions, apply single categorization
- Split transaction modal (Phase 2): allocate percentages (60/40 business/personal)
- Monthly review workflow with progress bar and completion state
- Target: 30–50 flagged transactions in under 10 minutes

## Implementation Phases

- **Phase 1 (COMPLETE):** Next.js migration, Drizzle schema, QBO OAuth + sync, Tier 1 rule engine, basic review UI, seed data
- **Phase 2 (CURRENT):** Auth + user management, live dashboard, keyboard shortcuts + batch mode, user feedback loop (auto-create rules from corrections), audit logging, fix categorization history bug, category/confidence SQL-level filtering
- **Phase 3:** Cash flow forecasting engine, budget builder, scenario modeling, true profitability reports, free cash flow calculations, export (PDF/CSV)
- **Phase 4:** Multi-practice management, accountant portal, Plaid integration for bank/investment accounts, net worth tracking, cost of capital dashboard
- **Phase 5:** Debt capacity model, business valuation, tax strategy alerts, ROI calculator
- **Phase 6:** Retirement planning, referral marketplace, partner integrations

## Security Requirements

- QBO tokens: AES-256-GCM encrypted at rest (IMPLEMENTED)
- All data in transit: TLS 1.3
- Auth: JWT with short-lived access tokens (15 min) + HTTP-only refresh cookies
- Database: Row-level security scoped to practice_id
- Intuit compliance: delete customer data within 30 days of QBO disconnection
- Audit log: every categorization change, data export, and admin action

## Code Style

- TypeScript throughout (.ts/.tsx) — no .js/.jsx for new files
- Functional components with hooks
- Named exports for utility modules, default exports for page/route components
- Components under 200 lines — extract subcomponents when exceeded
- Co-locate tests: `Component.test.tsx` next to `Component.tsx`
- Use `cn()` from `lib/utils` for conditional Tailwind classes
- API routes return NextResponse.json() with consistent error shapes: `{ error: string }`

## Known Issues (Fix in Phase 2)

1. **QBO account data ignored:** The `accountRef` field is captured from QBO and stored in the database, but the rule engine in `lib/categorization/rules.ts` never reads it. If a bookkeeper already categorized a transaction as "Lab Fees" in QBO, we should treat that as 90–95% confidence business — not run it through vendor matching as if we know nothing. This is the highest-priority fix.
2. **Categorization audit trail:** `app/api/categorize/[id]/route.ts` deletes old categorization before inserting new one. Should INSERT new row and keep history (latest row wins for display, full history preserved for audit).
3. **Post-query filtering:** `app/api/transactions/route.ts` filters category/confidence in JavaScript after SQL query. Move to SQL WHERE clauses for performance.
4. **No auth:** No user accounts, no login, no session management. All API routes are currently unauthenticated.
5. **No .env.example:** Need template with all required env vars documented.
6. **Dashboard is static:** Shows placeholder "--" values. Should query actual transaction/categorization counts.
7. **Transactions page is a placeholder:** Just shows "connect to get started" message.
