import { db } from "@/lib/db";
import {
  taxAlerts,
  referralOpportunities,
  budgets,
  transactions,
  retirementProfiles,
} from "@/lib/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { calculateProfitability } from "./profitability";
import { calculateFreeCashFlow } from "./cash-flow";
import { getAnnualDebtService } from "./loans";
import { calculateValuation } from "./valuation";

export interface CFOBriefing {
  headline: {
    metric: string;
    value: number;
    change: number;
    changePercent: number;
    trend: "up" | "down" | "flat";
  };
  actionItems: Array<{
    icon: string;
    title: string;
    description: string;
    urgency: "high" | "medium" | "low";
    link: string;
    source: string;
  }>;
  quickStats: {
    monthlyRevenue: number;
    monthlyExpenses: number;
    overheadRatio: number;
    overheadStatus: string;
    freeCashFlow: number;
    cashRunway: number;
    dscr: number;
    practiceValue: number;
    retirementReadiness: number;
  };
  activeAlerts: {
    taxAlerts: number;
    referralOpportunities: number;
    budgetOverages: number;
  };
}

export async function generateCFOBriefing(
  practiceId: string
): Promise<CFOBriefing> {
  const now = new Date();

  // 1. Get last 2 months profitability for month-over-month comparison
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59
  );
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    0,
    23,
    59,
    59
  );

  const [thisMonthReport, lastMonthReport] = await Promise.all([
    calculateProfitability(practiceId, thisMonthStart, thisMonthEnd),
    calculateProfitability(practiceId, lastMonthStart, lastMonthEnd),
  ]);

  const thisRevenue = thisMonthReport.revenue.total;
  const lastRevenue = lastMonthReport.revenue.total;
  const revenueChange = thisRevenue - lastRevenue;
  const revenueChangePercent =
    lastRevenue > 0 ? (revenueChange / lastRevenue) * 100 : 0;

  // 2. Get cash flow (free cash, calculate runway)
  const cashFlow = await calculateFreeCashFlow(practiceId, 3);
  const monthlyTrend = cashFlow.monthlyTrend;
  const latestMonth =
    monthlyTrend.length > 0 ? monthlyTrend[monthlyTrend.length - 1] : null;
  const freeCash = latestMonth?.combinedFreeCash ?? 0;
  const monthlyExpenses = thisMonthReport.operatingExpenses.total;
  const cashRunway = monthlyExpenses > 0 ? freeCash / monthlyExpenses : 0;

  // 3. Get DSCR from debt capacity
  let dscr = 0;
  try {
    const trailingStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const trailingEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59
    );
    const trailingProfit = await calculateProfitability(
      practiceId,
      trailingStart,
      trailingEnd
    );
    const annualNOI = trailingProfit.netOperatingIncome;
    const annualDebtService = await getAnnualDebtService(practiceId);
    dscr =
      annualDebtService > 0
        ? Math.round((annualNOI / annualDebtService) * 100) / 100
        : annualNOI > 0
          ? 99.99
          : 0;
  } catch {
    dscr = 0;
  }

  // 4. Get practice value from valuation
  let practiceValue = 0;
  try {
    const valuation = await calculateValuation(practiceId);
    practiceValue = Math.round(valuation.estimatedValue);
  } catch {
    practiceValue = 0;
  }

  // 5. Get retirement readiness (query retirement_profiles, handle null gracefully)
  let retirementReadiness = 0;
  try {
    const [profile] = await db
      .select({
        currentAge: retirementProfiles.currentAge,
        targetAge: retirementProfiles.targetRetirementAge,
      })
      .from(retirementProfiles)
      .where(eq(retirementProfiles.practiceId, practiceId))
      .limit(1);

    if (profile) {
      const yearsLeft = profile.targetAge - profile.currentAge;
      const totalYears = profile.targetAge - 30; // assumed career start
      retirementReadiness =
        totalYears > 0
          ? Math.round(
              Math.min(100, ((totalYears - yearsLeft) / totalYears) * 100)
            )
          : 0;
    }
  } catch {
    retirementReadiness = 0;
  }

  // 6. Count active tax alerts
  let taxAlertCount = 0;
  try {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(taxAlerts)
      .where(
        and(
          eq(taxAlerts.practiceId, practiceId),
          eq(taxAlerts.isDismissed, false)
        )
      );
    taxAlertCount = result?.count ?? 0;
  } catch {
    taxAlertCount = 0;
  }

  // 7. Count referral opportunities
  let referralCount = 0;
  try {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(referralOpportunities)
      .where(
        and(
          eq(referralOpportunities.practiceId, practiceId),
          eq(referralOpportunities.status, "detected")
        )
      );
    referralCount = result?.count ?? 0;
  } catch {
    referralCount = 0;
  }

  // 8. Count budget overages
  let budgetOverages = 0;
  try {
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const monthStart = new Date(currentYear, currentMonth - 1, 1);
    const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59);

    const budgetRows = await db
      .select({
        accountRef: budgets.accountRef,
        monthlyTarget: budgets.monthlyTarget,
      })
      .from(budgets)
      .where(
        and(eq(budgets.practiceId, practiceId), eq(budgets.year, currentYear))
      );

    if (budgetRows.length > 0) {
      const actuals = await db
        .select({
          accountRef: transactions.accountRef,
          total: sql<string>`sum(abs(${transactions.amount}::numeric))`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.practiceId, practiceId),
            gte(transactions.date, monthStart),
            lte(transactions.date, monthEnd),
            sql`${transactions.amount}::numeric < 0`
          )
        )
        .groupBy(transactions.accountRef);

      const actualMap = new Map(
        actuals.map((r) => [r.accountRef, parseFloat(r.total)])
      );

      for (const b of budgetRows) {
        const actual = actualMap.get(b.accountRef) ?? 0;
        const target = parseFloat(b.monthlyTarget);
        if (actual > target * 1.1) {
          budgetOverages++;
        }
      }
    }
  } catch {
    budgetOverages = 0;
  }

  // 9. Generate action items by priority
  const actionItems: CFOBriefing["actionItems"] = [];

  if (taxAlertCount > 0) {
    actionItems.push({
      icon: "FileText",
      title: `${taxAlertCount} Tax Alert${taxAlertCount > 1 ? "s" : ""} Need Attention`,
      description: "Review tax strategy opportunities before deadlines pass.",
      urgency: "high",
      link: "/finance/tax-strategy",
      source: "tax-strategy",
    });
  }

  if (budgetOverages > 0) {
    actionItems.push({
      icon: "AlertTriangle",
      title: `${budgetOverages} Budget Categor${budgetOverages > 1 ? "ies" : "y"} Over Target`,
      description: "Some expense categories exceeded their monthly budget.",
      urgency: "medium",
      link: "/finance/budget",
      source: "budget",
    });
  }

  if (referralCount > 0) {
    actionItems.push({
      icon: "Sparkles",
      title: `${referralCount} Savings Opportunit${referralCount > 1 ? "ies" : "y"} Detected`,
      description: "Potential cost savings through our partner network.",
      urgency: "medium",
      link: "/referrals",
      source: "referrals",
    });
  }

  if (thisMonthReport.overheadStatus === "critical") {
    actionItems.push({
      icon: "TrendingDown",
      title: "Overhead Ratio Critical",
      description: `Overhead is ${Math.round(thisMonthReport.overheadRatio * 100)}% — well above target range.`,
      urgency: "high",
      link: "/finance",
      source: "profitability",
    });
  } else if (thisMonthReport.overheadStatus === "elevated") {
    actionItems.push({
      icon: "TrendingDown",
      title: "Overhead Ratio Elevated",
      description: `Overhead is ${Math.round(thisMonthReport.overheadRatio * 100)}% — above the recommended range.`,
      urgency: "medium",
      link: "/finance",
      source: "profitability",
    });
  }

  if (dscr > 0 && dscr < 1.25) {
    actionItems.push({
      icon: "Scale",
      title: "Debt Coverage Below Target",
      description: `DSCR is ${dscr.toFixed(2)}x — below the 1.25x safety threshold.`,
      urgency: "high",
      link: "/finance/debt-capacity",
      source: "debt-capacity",
    });
  }

  // Sort by urgency and take top 3
  const urgencyOrder = { high: 0, medium: 1, low: 2 };
  actionItems.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
  const topActions = actionItems.slice(0, 3);

  return {
    headline: {
      metric: "Monthly Revenue",
      value: Math.round(thisRevenue),
      change: Math.round(revenueChange),
      changePercent: Math.round(revenueChangePercent * 10) / 10,
      trend:
        revenueChangePercent > 2
          ? "up"
          : revenueChangePercent < -2
            ? "down"
            : "flat",
    },
    actionItems: topActions,
    quickStats: {
      monthlyRevenue: Math.round(thisRevenue),
      monthlyExpenses: Math.round(monthlyExpenses),
      overheadRatio: Math.round(thisMonthReport.overheadRatio * 1000) / 10,
      overheadStatus: thisMonthReport.overheadStatus,
      freeCashFlow: Math.round(freeCash),
      cashRunway: Math.round(cashRunway * 10) / 10,
      dscr,
      practiceValue,
      retirementReadiness,
    },
    activeAlerts: {
      taxAlerts: taxAlertCount,
      referralOpportunities: referralCount,
      budgetOverages,
    },
  };
}
