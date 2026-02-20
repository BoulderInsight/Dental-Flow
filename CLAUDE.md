# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DentalFlow Pro is an interactive architecture visualization for a dental practice financial management system. It's currently a single-page React app that renders an SVG-based system architecture diagram with clickable components showing implementation details.

The visualization documents the planned full system: QBO integration, sync engine, PostgreSQL/Redis data layer, 3-tier categorization (rules → ML → user feedback), transaction review UI, and cash flow forecasting. Only the architecture visualization component exists as code today — the backend services it describes are not yet implemented.

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

- React 19 with TypeScript
- Next.js 15 (App Router)
- Tailwind CSS + shadcn/ui components
- Drizzle ORM + PostgreSQL 16
- TanStack Query + TanStack Table
- Zustand for client state
- Docker Compose for local PostgreSQL + Redis

## Architecture

- `app/` — Next.js App Router pages and API routes
- `app/layout.tsx` — Root layout with sidebar nav + TanStack Query provider
- `app/providers.tsx` — Client-side providers (QueryClient)
- `app/api/` — API route handlers (QBO OAuth, transactions, categorization)
- `components/ui/` — shadcn/ui primitives (button, card, badge, etc.)
- `components/layout/sidebar.tsx` — App sidebar navigation
- `components/review/` — Transaction review UI components
- `components/qbo/` — QuickBooks connection components
- `lib/db/` — Drizzle schema, connection, seed
- `lib/qbo/` — QBO OAuth client, encryption, sync, demo mode
- `lib/categorization/` — Tier 1 rule engine (vendors, rules, orchestrator)
- `lib/store/` — Zustand stores
- `src/DentalFlow_Architecture.jsx` — Preserved original architecture visualization (self-contained JSX with inline styles)

## ESLint

The `no-unused-vars` rule is configured to ignore variables starting with uppercase letters or underscores (`varsIgnorePattern: '^[A-Z_]'`).

# Recommended additions to CLAUDE.md
# Paste everything below the existing content
# ─────────────────────────────────────────────

## System Design Decisions (Authoritative)

This section captures architectural decisions that have already been made. Do not deviate from these without explicit approval.

### QuickBooks Online Integration

- Use Intuit's OAuth 2.0 authorization code flow with scope `com.intuit.quickbooks.accounting`
- Use the official `node-quickbooks` or Intuit Node.js SDK
- Token storage: AES-256-GCM encrypted in PostgreSQL (never plaintext, never in .env)
- Proactive token refresh: background job refreshes access tokens at the 50-minute mark (tokens expire at 60 min)
- Refresh tokens rotate on each use per Intuit's rolling refresh policy (100-day lifetime)
- On initial connect: full sync of last 12 months from Purchase, Deposit, Transfer, Account, Vendor endpoints
- Ongoing sync: register a QBO webhook subscription for change events + daily batch reconciliation
- Phase 1–2 is READ-ONLY from QBO. No write-back until Phase 3 (with preview + confirm safeguard)
- Deduplicate by `qbo_txn_id` — always store raw JSON alongside parsed fields for audit trail

### Transaction Categorization — Three-Tier Engine

**Tier 1: Deterministic Rules (target: 55–65% of transactions)**
- Hard-coded vendor matching against a curated dental industry list
- Known business vendors (100% confidence): Henry Schein, Patterson Dental, Benco Dental, Darby Dental, Net32, Glidewell, Burbank Dental Lab, plus any vendor with "dental lab" in name
- Known software (100%): Dentrix, Eaglesoft, Open Dental, Pearl, Weave, Curve Dental
- Known payroll (100%): ADP, Gusto, Paychex, QuickBooks Payroll
- Known personal (95%): Netflix, Spotify, gym memberships, meal kits
- Ambiguous/flagged: Amazon, Walmart, Target (always require review)
- Address-based: rent/mortgage classified by matching to known practice vs home address

**Tier 2: ML Classification (Python FastAPI microservice)**
- Fine-tuned DistilBERT on labeled dental practice transaction data
- Input features: merchant name, memo/description, QBO account category, amount, day/time
- Temporal pattern detection for recurring charges
- Dental-specific amount heuristics (e.g., $3,500 to dental vendor = business; $35 restaurant at lunch = likely personal)
- Cross-account correlation (transfers to personal accounts flag downstream spending)

**Tier 3: User Feedback Loop**
- Every user correction creates a user-specific rule (highest priority)
- Corrections are logged with original prediction, correction, and context
- Aggregated anonymized corrections retrain the ML model quarterly

**Confidence Scoring:**
- 90–100%: Auto-categorized (green in UI), no action needed
- 70–89%: Suggested category (yellow), soft prompt to confirm
- Below 70%: Flagged ambiguous (orange/red), must review before included in reports

### Database Schema (PostgreSQL 16)

Core tables — do not rename or restructure without discussion:
- `practices` — id, name, qbo_realm_id, qbo_tokens (encrypted), fiscal_year_start, practice_addresses[]
- `transactions` — id, practice_id, qbo_txn_id, date, amount, vendor_name, description, account_ref, raw_json
- `categorizations` — id, transaction_id, category (business|personal|ambiguous), confidence, source (rule|ml|user), rule_id, created_at
- `user_rules` — id, practice_id, match_type (vendor|description|amount_range), match_value, category, priority
- `review_sessions` — id, practice_id, user_id, period_start, period_end, status (in_progress|completed), completed_at
- `forecasts` — id, practice_id, forecast_date, period_months, method, parameters_json, results_json

Row-level security scoped to `practice_id`. Full audit logging on all mutations.

### Cash Flow Forecasting

- Operates ONLY on confirmed business-classified transactions
- Primary model: Holt-Winters triple exponential smoothing
- Dental seasonality adjustments: summer dip (Jun–Aug), year-end insurance rush (Nov–Dec), January benefit reset
- Key output metrics: Net Operating Cash Flow, Cash Runway, Overhead Ratio (benchmark: 55–65%), Confidence Intervals (80% and 95%)
- Scenario modeling via adjustable sliders ("What if I hire an associate?")

### Target Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14+ (App Router), TanStack Query, Zustand, Tailwind CSS, shadcn/ui, TanStack Table, Recharts |
| API | Node.js / Express or Next.js API Routes |
| Classification | Python FastAPI microservice |
| Database | PostgreSQL 16 + Redis (BullMQ for job queue) |
| Auth | NextAuth.js or Clerk (handles both app login and QBO OAuth) |

**Note:** The current repo is plain Vite + React. Migration to Next.js is expected. When that happens, preserve the architecture visualization component.

### Review Interface — UX Requirements

This is the most critical screen. Design for speed and keyboard navigation:
- Split-panel layout: filterable transaction list (left) + transaction detail (right)
- Default sort: lowest confidence first
- Keyboard shortcuts: B = Business, P = Personal, S = Split, R = Create Rule, Arrow Down = Next
- Batch mode: select multiple same-vendor transactions, apply single categorization
- Split transaction modal: allocate percentages (e.g., 60% business / 40% personal)
- Monthly review workflow with progress indicator and completion state
- Target: user should clear 30–50 flagged transactions in under 10 minutes

## Implementation Phases

When building, follow this phase order. Do not jump ahead.

- **Phase 1 (Weeks 1–4):** QBO OAuth + token management, transaction sync pipeline, PostgreSQL schema + migrations, Tier 1 deterministic rule engine, minimal review UI (transaction list with Business/Personal toggle)
- **Phase 2 (Weeks 5–8):** ML classification service (Tier 2), full review interface with keyboard nav + batch ops, user feedback loop (Tier 3), split transaction support, monthly review workflow
- **Phase 3 (Weeks 9–12):** Forecasting engine, budget builder, dashboard with charts, scenario modeling, export (PDF, CSV, QBO journal entry write-back with preview + confirm)
- **Phase 4 (Weeks 13–16):** Multi-practice support, accountant portal, mobile-responsive review, peer benchmarks

## Security Requirements

- All QBO tokens encrypted at rest (AES-256-GCM)
- All data in transit over TLS 1.3
- JWT auth with short-lived access tokens (15 min) + HTTP-only refresh cookies
- Row-level security in PostgreSQL scoped to practice_id
- Delete customer data within 30 days of QBO disconnection (Intuit compliance)
- Audit log every categorization change, data export, and admin action

## Code Style Preferences

- Use JSX (not TSX) unless migrating to TypeScript is explicitly agreed
- Prefer functional components with hooks
- Use named exports for utility modules, default exports for page/route components
- Keep components under 200 lines — extract into subcomponents when exceeded
- Co-locate tests with source files (e.g., `Component.test.jsx` next to `Component.jsx`)

