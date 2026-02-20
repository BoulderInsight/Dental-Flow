import { db } from "@/lib/db";
import {
  practices,
  reviewSessions,
  budgets,
  plaidConnections,
  loans,
  retirementProfiles,
  referralOpportunities,
} from "@/lib/db/schema";
import { eq, and, sql, ne } from "drizzle-orm";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  isComplete: boolean;
  link: string;
  priority: number;
}

export async function getOnboardingChecklist(
  practiceId: string
): Promise<OnboardingStep[]> {
  // Run all checks in parallel
  const [
    practiceRow,
    reviewCount,
    budgetCount,
    plaidCount,
    loanCount,
    retirementCount,
    referralReviewedCount,
  ] = await Promise.all([
    // 1. QBO connected
    db
      .select({ qboTokens: practices.qboTokens })
      .from(practices)
      .where(eq(practices.id, practiceId))
      .limit(1)
      .then((rows) => rows[0]),

    // 2. Reviewed transactions
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(reviewSessions)
      .where(
        and(
          eq(reviewSessions.practiceId, practiceId),
          eq(reviewSessions.status, "completed")
        )
      )
      .then((rows) => rows[0]?.count ?? 0),

    // 3. Budget targets set
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(budgets)
      .where(eq(budgets.practiceId, practiceId))
      .then((rows) => rows[0]?.count ?? 0),

    // 4. Plaid connected
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(plaidConnections)
      .where(eq(plaidConnections.practiceId, practiceId))
      .then((rows) => rows[0]?.count ?? 0),

    // 5. Loans added
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(loans)
      .where(eq(loans.practiceId, practiceId))
      .then((rows) => rows[0]?.count ?? 0),

    // 6. Retirement goals set
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(retirementProfiles)
      .where(eq(retirementProfiles.practiceId, practiceId))
      .then((rows) => rows[0]?.count ?? 0),

    // 7. Reviewed referral opportunities
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(referralOpportunities)
      .where(
        and(
          eq(referralOpportunities.practiceId, practiceId),
          ne(referralOpportunities.status, "detected")
        )
      )
      .then((rows) => rows[0]?.count ?? 0),
  ]);

  return [
    {
      id: "qbo",
      title: "Connect QuickBooks",
      description: "Link your QuickBooks Online account to sync transactions automatically.",
      isComplete: !!practiceRow?.qboTokens,
      link: "/settings/accounts",
      priority: 1,
    },
    {
      id: "review",
      title: "Review Transactions",
      description: "Complete your first transaction review session to train the categorization engine.",
      isComplete: reviewCount > 0,
      link: "/review",
      priority: 2,
    },
    {
      id: "budget",
      title: "Set Budget Targets",
      description: "Configure monthly budget targets to track spending against goals.",
      isComplete: budgetCount > 0,
      link: "/finance/budget",
      priority: 3,
    },
    {
      id: "plaid",
      title: "Connect Bank Accounts",
      description: "Link personal accounts via Plaid for complete net worth tracking.",
      isComplete: plaidCount > 0,
      link: "/settings/accounts",
      priority: 4,
    },
    {
      id: "loans",
      title: "Add Your Loans",
      description: "Enter or detect loans to enable debt capacity and cost of capital analysis.",
      isComplete: loanCount > 0,
      link: "/finance/loans",
      priority: 5,
    },
    {
      id: "retirement",
      title: "Set Retirement Goals",
      description: "Define your retirement timeline and income goals for long-term planning.",
      isComplete: retirementCount > 0,
      link: "/finance/retirement",
      priority: 6,
    },
    {
      id: "referrals",
      title: "Review Opportunities",
      description: "Check savings opportunities detected from your financial data.",
      isComplete: referralReviewedCount > 0,
      link: "/referrals",
      priority: 7,
    },
  ];
}
