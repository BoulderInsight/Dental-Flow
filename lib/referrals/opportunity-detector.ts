import { db } from "@/lib/db";
import { transactions, categorizations, retirementProfiles } from "@/lib/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { calculateCostOfCapital } from "@/lib/finance/cost-of-capital";
import { calculateNetWorth } from "@/lib/finance/net-worth";
import { calculateProfitability } from "@/lib/finance/profitability";
import { calculateValuation } from "@/lib/finance/valuation";
import { getLoans } from "@/lib/finance/loans";

export interface DetectedOpportunity {
  opportunityType: string;
  title: string;
  description: string;
  estimatedSavings: number | null;
  estimatedValue: number | null;
  priority: "high" | "medium" | "low";
  partnerCategory: string;
  metadata: Record<string, unknown>;
  expiresAt: Date | null;
}

const INSURANCE_KEYWORDS = [
  "insurance",
  "premium",
  "policy",
  "coverage",
  "indemnity",
  "liability insurance",
  "malpractice",
  "workers comp",
  "health insurance",
  "dental insurance",
  "vision insurance",
  "life insurance",
  "disability",
  "umbrella",
];

const CPA_KEYWORDS = [
  "cpa",
  "accountant",
  "accounting",
  "tax prep",
  "tax preparation",
  "tax return",
  "bookkeeping",
  "turbotax",
  "h&r block",
  "intuit",
];

const FINANCIAL_ADVISOR_KEYWORDS = [
  "financial advisor",
  "financial planner",
  "wealth management",
  "merrill",
  "fidelity",
  "schwab",
  "vanguard",
  "edward jones",
  "ameriprise",
  "raymond james",
];

const REPAIR_KEYWORDS = [
  "repair",
  "maintenance",
  "service call",
  "technician",
  "fix",
  "broken",
  "replacement part",
];

const latestCatId = sql`(
  SELECT c.id FROM categorizations c
  WHERE c.transaction_id = ${transactions.id}
  ORDER BY c.created_at DESC LIMIT 1
)`;

/**
 * Scan transactions for keyword matches in the last N months.
 */
async function scanTransactionsForKeywords(
  practiceId: string,
  keywords: string[],
  monthsBack: number
): Promise<{ found: boolean; total: number; count: number }> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - monthsBack);
  startDate.setDate(1);

  const rows = await db
    .select({
      amount: transactions.amount,
      vendorName: transactions.vendorName,
      description: transactions.description,
      accountRef: transactions.accountRef,
    })
    .from(transactions)
    .leftJoin(
      categorizations,
      and(
        eq(transactions.id, categorizations.transactionId),
        eq(categorizations.id, latestCatId)
      )
    )
    .where(
      and(
        eq(transactions.practiceId, practiceId),
        gte(transactions.date, startDate)
      )
    );

  let total = 0;
  let count = 0;

  for (const row of rows) {
    const searchText = [
      row.vendorName || "",
      row.description || "",
      row.accountRef || "",
    ]
      .join(" ")
      .toLowerCase();

    const amount = Math.abs(parseFloat(row.amount));

    if (keywords.some((k) => searchText.includes(k.toLowerCase()))) {
      count++;
      total += amount;
    }
  }

  return { found: count > 0, total, count };
}

/**
 * Detect all financial opportunities for a practice.
 * Analyzes loans, insurance, tax planning, exit planning, equipment,
 * financial advisor needs, and debt consolidation.
 */
export async function detectOpportunities(
  practiceId: string
): Promise<DetectedOpportunity[]> {
  const opportunities: DetectedOpportunity[] = [];
  const now = new Date();

  // Gather data in parallel where possible
  const [costOfCapital, profitabilityResult, allLoans] = await Promise.all([
    calculateCostOfCapital(practiceId).catch(() => null),
    calculateProfitability(
      practiceId,
      new Date(now.getFullYear() - 1, now.getMonth(), 1),
      new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    ).catch(() => null),
    getLoans(practiceId).catch(() => []),
  ]);

  // 1. Loan Refinance (high priority)
  if (costOfCapital && costOfCapital.refinanceOpportunities.length > 0) {
    for (const refi of costOfCapital.refinanceOpportunities) {
      // Only surface opportunities with meaningful savings (> 1.5% rate spread)
      const rateSpread = refi.currentRate - refi.estimatedMarketRate;
      if (rateSpread < 0.015) continue;

      opportunities.push({
        opportunityType: "loan_refinance",
        title: `Refinance Opportunity: ${refi.loanName}`,
        description: `Your ${refi.loanName} has a rate of ${(refi.currentRate * 100).toFixed(2)}%, which is ${(rateSpread * 100).toFixed(1)}% above the estimated market rate of ${(refi.estimatedMarketRate * 100).toFixed(2)}%. Refinancing could save ~$${Math.round(refi.potentialMonthlySavings).toLocaleString()}/month ($${Math.round(refi.potentialTotalSavings).toLocaleString()} total).`,
        estimatedSavings: refi.potentialTotalSavings,
        estimatedValue: null,
        priority: "high",
        partnerCategory: "lender",
        metadata: {
          loanId: refi.loanId,
          loanName: refi.loanName,
          currentRate: refi.currentRate,
          marketRate: refi.estimatedMarketRate,
          monthlySavings: refi.potentialMonthlySavings,
          totalSavings: refi.potentialTotalSavings,
          breakEvenMonths: refi.breakEvenMonths,
        },
        expiresAt: null,
      });
    }
  }

  // 2. Insurance Review (medium priority)
  const insuranceScan = await scanTransactionsForKeywords(
    practiceId,
    INSURANCE_KEYWORDS,
    12
  );
  const annualRevenue = profitabilityResult?.revenue.total ?? 0;

  if (!insuranceScan.found) {
    // No insurance transactions in 12 months
    opportunities.push({
      opportunityType: "insurance_review",
      title: "Insurance Coverage Review Recommended",
      description:
        "No insurance-related transactions were detected in the last 12 months. Ensuring you have adequate business, liability, and malpractice coverage is critical for protecting your practice.",
      estimatedSavings: null,
      estimatedValue: null,
      priority: "medium",
      partnerCategory: "insurance",
      metadata: { reason: "no_insurance_detected", monthsScanned: 12 },
      expiresAt: null,
    });
  } else if (annualRevenue > 0 && insuranceScan.total / annualRevenue > 0.05) {
    // Insurance costs exceed 5% of revenue
    const pct = ((insuranceScan.total / annualRevenue) * 100).toFixed(1);
    const potentialSavings = insuranceScan.total * 0.15; // assume 15% savings via shopping
    opportunities.push({
      opportunityType: "insurance_review",
      title: "Insurance Costs May Be High",
      description: `Insurance-related spending is ~${pct}% of revenue ($${Math.round(insuranceScan.total).toLocaleString()}/year). An insurance broker review could identify redundant coverage or competitive rates, potentially saving ~$${Math.round(potentialSavings).toLocaleString()}/year.`,
      estimatedSavings: potentialSavings,
      estimatedValue: null,
      priority: "medium",
      partnerCategory: "insurance",
      metadata: {
        reason: "high_insurance_cost",
        insuranceSpend: insuranceScan.total,
        revenuePercent: parseFloat(pct),
      },
      expiresAt: null,
    });
  }

  // 3. Tax Planning (high, seasonal — Q4 + income > $250K + no CPA)
  const currentMonth = now.getMonth() + 1; // 1-indexed
  const isQ4 = currentMonth >= 10;
  const projectedIncome = profitabilityResult
    ? (profitabilityResult.netOperatingIncome / currentMonth) * 12
    : 0;

  if (isQ4 && projectedIncome > 250000) {
    const cpaScan = await scanTransactionsForKeywords(
      practiceId,
      CPA_KEYWORDS,
      12
    );

    if (!cpaScan.found) {
      const estimatedTaxSavings = projectedIncome * 0.05; // conservative 5% optimization
      opportunities.push({
        opportunityType: "tax_planning",
        title: "Year-End Tax Planning Needed",
        description: `With projected income of ~$${Math.round(projectedIncome).toLocaleString()} and no CPA engagement detected, year-end tax planning could save ~$${Math.round(estimatedTaxSavings).toLocaleString()} through retirement contributions, equipment purchases, and entity structure optimization.`,
        estimatedSavings: estimatedTaxSavings,
        estimatedValue: null,
        priority: "high",
        partnerCategory: "cpa",
        metadata: {
          projectedIncome,
          quarter: "Q4",
          noCpaDetected: true,
        },
        expiresAt: new Date(now.getFullYear(), 11, 31),
      });
    }
  }

  // 4. Exit Planning (medium priority)
  const [retirementProfile] = await db
    .select()
    .from(retirementProfiles)
    .where(eq(retirementProfiles.practiceId, practiceId))
    .limit(1);

  let suggestExitPlanning = false;
  const exitMetadata: Record<string, unknown> = {};

  if (retirementProfile && retirementProfile.currentAge >= 55) {
    suggestExitPlanning = true;
    exitMetadata.reason = "age_threshold";
    exitMetadata.currentAge = retirementProfile.currentAge;
    exitMetadata.targetRetirementAge = retirementProfile.targetRetirementAge;
  }

  // Also check if valuation is declining
  try {
    const valuation = await calculateValuation(practiceId);
    if (valuation.historicalValues.length >= 2) {
      const values = valuation.historicalValues;
      const recent = values[values.length - 1].estimatedValue;
      const prior = values[values.length - 2].estimatedValue;
      if (prior > 0 && recent < prior * 0.95) {
        suggestExitPlanning = true;
        exitMetadata.valuationDeclining = true;
        exitMetadata.recentValuation = recent;
        exitMetadata.priorValuation = prior;
      }
    }
    exitMetadata.estimatedValue = valuation.estimatedValue;
  } catch {
    // valuation calc may fail with no data — skip
  }

  if (suggestExitPlanning) {
    opportunities.push({
      opportunityType: "exit_planning",
      title: "Practice Exit/Transition Planning",
      description: retirementProfile
        ? `At age ${retirementProfile.currentAge} with a target retirement of ${retirementProfile.targetRetirementAge}, it is a good time to start planning your practice transition. A broker can help maximize your sale price and ensure a smooth handoff.`
        : "Valuation trends suggest this may be a good time to explore practice transition options with a qualified broker.",
      estimatedSavings: null,
      estimatedValue:
        typeof exitMetadata.estimatedValue === "number"
          ? exitMetadata.estimatedValue
          : null,
      priority: "medium",
      partnerCategory: "broker",
      metadata: exitMetadata,
      expiresAt: null,
    });
  }

  // 5. Equipment Financing (low priority)
  const repairScan = await scanTransactionsForKeywords(
    practiceId,
    REPAIR_KEYWORDS,
    12
  );

  if (repairScan.total > 10000) {
    // High repair costs suggest aging equipment
    opportunities.push({
      opportunityType: "equipment_financing",
      title: "Equipment Upgrade Opportunity",
      description: `You spent $${Math.round(repairScan.total).toLocaleString()} on repairs/maintenance in the last 12 months. Financing new equipment may reduce ongoing repair costs and improve efficiency, with Section 179 tax benefits.`,
      estimatedSavings: repairScan.total * 0.5, // assume 50% reduction in repair costs
      estimatedValue: null,
      priority: "low",
      partnerCategory: "equipment_financing",
      metadata: {
        repairSpend12Months: repairScan.total,
        repairTransactions: repairScan.count,
      },
      expiresAt: null,
    });
  }

  // 6. Financial Advisor (medium priority)
  let netWorthReport;
  try {
    netWorthReport = await calculateNetWorth(practiceId);
  } catch {
    netWorthReport = null;
  }

  if (netWorthReport && netWorthReport.netWorth > 1000000) {
    const advisorScan = await scanTransactionsForKeywords(
      practiceId,
      FINANCIAL_ADVISOR_KEYWORDS,
      12
    );

    // Check retirement readiness if profile exists
    let retirementReadiness = 100; // default: assume fine
    if (retirementProfile) {
      const monthlyNeeded = parseFloat(
        retirementProfile.desiredMonthlyIncome || "0"
      );
      const ssEstimate = parseFloat(
        retirementProfile.socialSecurityEstimate || "0"
      );
      const gap = monthlyNeeded - ssEstimate;
      const neededAtRetirement = gap * 12 * 25; // 4% rule
      const currentRetirementAssets = netWorthReport.assets.retirement;
      retirementReadiness =
        neededAtRetirement > 0
          ? Math.min(
              100,
              Math.round((currentRetirementAssets / neededAtRetirement) * 100)
            )
          : 100;
    }

    if (!advisorScan.found && retirementReadiness < 60) {
      opportunities.push({
        opportunityType: "financial_advisor",
        title: "Consider a Financial Advisor",
        description: `With a net worth of $${Math.round(netWorthReport.netWorth).toLocaleString()} and a retirement readiness score of ${retirementReadiness}%, working with a financial advisor could help optimize your investment strategy, retirement planning, and wealth preservation.`,
        estimatedSavings: null,
        estimatedValue: netWorthReport.netWorth,
        priority: "medium",
        partnerCategory: "financial_advisor",
        metadata: {
          netWorth: netWorthReport.netWorth,
          retirementReadiness,
          noAdvisorDetected: true,
        },
        expiresAt: null,
      });
    }
  }

  // 7. Debt Consolidation (medium priority)
  if (allLoans.length >= 3 && costOfCapital) {
    const wacc = costOfCapital.weightedAverageCost;
    if (wacc > 0.08) {
      const totalDebt = costOfCapital.totalDebt;
      const potentialSavings = totalDebt * (wacc - 0.065) * 0.5; // rough savings estimate
      opportunities.push({
        opportunityType: "debt_consolidation",
        title: "Debt Consolidation Opportunity",
        description: `You have ${allLoans.length} active loans with a weighted average cost of ${(wacc * 100).toFixed(1)}%. Consolidating into a single loan at a lower rate could simplify payments and reduce total interest by ~$${Math.round(potentialSavings).toLocaleString()}.`,
        estimatedSavings: potentialSavings > 0 ? potentialSavings : null,
        estimatedValue: null,
        priority: "medium",
        partnerCategory: "lender",
        metadata: {
          loanCount: allLoans.length,
          wacc,
          totalDebt,
          totalMonthlyPayment: costOfCapital.totalMonthlyDebtService,
        },
        expiresAt: null,
      });
    }
  }

  // Sort: high -> medium -> low
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  opportunities.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  return opportunities;
}
