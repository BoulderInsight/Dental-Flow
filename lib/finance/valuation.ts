import { db } from "@/lib/db";
import { transactions, categorizations, valuationSnapshots } from "@/lib/db/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { getConfigForPractice } from "@/lib/industries";
import { calculateProfitability } from "./profitability";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ValuationMultipleResult {
  low: number;
  mid: number;
  high: number;
  multiplier: { low: number; mid: number; high: number };
}

export interface ValuationFactor {
  factor: string;
  impact: "positive" | "neutral" | "negative";
  description: string;
}

export interface HistoricalValuationPoint {
  date: string;
  estimatedValue: number;
  revenue: number;
  ebitda: number;
}

export interface ValuationReport {
  asOfDate: Date;
  industryName: string;
  annualRevenue: number;
  annualExpenses: number;
  ebitda: number;
  ownerCompensation: number;
  sde: number;
  interestExpense: number;
  depreciationAmortization: number;
  revenueMultiple: ValuationMultipleResult;
  ebitdaMultiple: ValuationMultipleResult;
  sdeMultiple: ValuationMultipleResult;
  estimatedValue: number;
  valueRange: { low: number; high: number };
  historicalValues: HistoricalValuationPoint[];
  factors: ValuationFactor[];
  suggestions: string[];
  disclaimer: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const DISCLAIMER =
  "This analysis is for informational purposes only and does not constitute financial, tax, or legal advice. Consult your CPA, financial advisor, or attorney before making financial decisions.";

const INTEREST_PATTERNS = [
  "interest",
  "loan interest",
  "mortgage interest",
  "finance charge",
  "interest expense",
];

const DA_PATTERNS = [
  "depreciation",
  "amortization",
  "depreciation expense",
  "amortization expense",
  "accumulated depreciation",
];

const DEBT_SERVICE_PATTERNS = [
  "loan payment",
  "note payable",
  "loan interest",
  "equipment loan",
  "practice loan",
  "mortgage",
  "line of credit",
  "interest",
];

const DEFAULT_MULTIPLIERS = {
  revenueMultiple: { low: 0.4, mid: 0.6, high: 0.8 },
  ebitdaMultiple: { low: 3.0, mid: 4.0, high: 5.0 },
  sdeMultiple: { low: 1.5, mid: 2.25, high: 3.0 },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function matchesPatterns(accountRef: string | null, patterns: string[]): boolean {
  if (!accountRef) return false;
  const lower = accountRef.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

/**
 * Scan transactions to approximate interest expense and D&A.
 * These are typically broken out as account refs containing specific keywords.
 */
async function estimateEbitdaAddbacks(
  practiceId: string,
  startDate: Date,
  endDate: Date
): Promise<{ interestExpense: number; depreciationAmortization: number; debtService: number }> {
  const latestCatId = sql`(
    SELECT c.id FROM categorizations c
    WHERE c.transaction_id = ${transactions.id}
    ORDER BY c.created_at DESC LIMIT 1
  )`;

  const rows = await db
    .select({
      amount: transactions.amount,
      accountRef: transactions.accountRef,
      category: categorizations.category,
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
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    );

  let interestExpense = 0;
  let depreciationAmortization = 0;
  let debtService = 0;

  for (const row of rows) {
    const amount = parseFloat(row.amount);
    if (amount >= 0) continue; // Only expenses (negative amounts)

    const absAmount = Math.abs(amount);

    if (matchesPatterns(row.accountRef, INTEREST_PATTERNS)) {
      interestExpense += absAmount;
    }
    if (matchesPatterns(row.accountRef, DA_PATTERNS)) {
      depreciationAmortization += absAmount;
    }
    if (matchesPatterns(row.accountRef, DEBT_SERVICE_PATTERNS)) {
      debtService += absAmount;
    }
  }

  return { interestExpense, depreciationAmortization, debtService };
}

/**
 * Analyze factors that impact business value.
 */
function analyzeFactors(
  profitability: Awaited<ReturnType<typeof calculateProfitability>>,
  ebitda: number,
  debtService: number,
  overheadBenchmarkMax: number
): { factors: ValuationFactor[]; suggestions: string[] } {
  const factors: ValuationFactor[] = [];
  const suggestions: string[] = [];
  const monthly = profitability.monthlyBreakdown;

  // Factor 1: Revenue trend — compare last 3 months to prior 3 months
  if (monthly.length >= 6) {
    const recent3 = monthly.slice(-3);
    const prior3 = monthly.slice(-6, -3);
    const recentAvg =
      recent3.reduce((s, m) => s + m.revenue, 0) / recent3.length;
    const priorAvg =
      prior3.reduce((s, m) => s + m.revenue, 0) / prior3.length;
    const changePct = priorAvg > 0 ? ((recentAvg - priorAvg) / priorAvg) * 100 : 0;

    if (changePct > 5) {
      factors.push({
        factor: "Revenue Trend",
        impact: "positive",
        description: `Revenue is growing: +${changePct.toFixed(1)}% over the last quarter vs. the prior quarter.`,
      });
    } else if (changePct < -5) {
      factors.push({
        factor: "Revenue Trend",
        impact: "negative",
        description: `Revenue is declining: ${changePct.toFixed(1)}% over the last quarter vs. the prior quarter.`,
      });
      suggestions.push(
        "Stabilize or grow revenue through marketing, patient retention programs, or expanding services."
      );
    } else {
      factors.push({
        factor: "Revenue Trend",
        impact: "neutral",
        description: `Revenue is stable (${changePct > 0 ? "+" : ""}${changePct.toFixed(1)}% change quarter-over-quarter).`,
      });
    }
  } else if (monthly.length > 0) {
    factors.push({
      factor: "Revenue Trend",
      impact: "neutral",
      description: "Insufficient data for trend analysis (need 6+ months).",
    });
  }

  // Factor 2: Overhead ratio vs benchmark
  const overheadPct = Math.round(profitability.overheadRatio * 100);
  const benchmarkPct = Math.round(overheadBenchmarkMax * 100);
  if (profitability.overheadRatio < overheadBenchmarkMax * 0.9) {
    factors.push({
      factor: "Overhead Efficiency",
      impact: "positive",
      description: `Overhead ratio of ${overheadPct}% is well below the ${benchmarkPct}% industry benchmark.`,
    });
  } else if (profitability.overheadRatio <= overheadBenchmarkMax) {
    factors.push({
      factor: "Overhead Efficiency",
      impact: "neutral",
      description: `Overhead ratio of ${overheadPct}% is within the industry benchmark of ${benchmarkPct}%.`,
    });
  } else {
    factors.push({
      factor: "Overhead Efficiency",
      impact: "negative",
      description: `Overhead ratio of ${overheadPct}% exceeds the ${benchmarkPct}% industry benchmark.`,
    });
    suggestions.push(
      "Reduce overhead below the industry benchmark to improve profitability and valuation multiples."
    );
  }

  // Factor 3: Profitability margin
  const netMargin =
    profitability.revenue.total > 0
      ? profitability.netOperatingIncome / profitability.revenue.total
      : 0;
  const marginPct = Math.round(netMargin * 100);
  if (netMargin > 0.25) {
    factors.push({
      factor: "Net Operating Margin",
      impact: "positive",
      description: `Net operating margin of ${marginPct}% indicates strong profitability.`,
    });
  } else if (netMargin > 0.1) {
    factors.push({
      factor: "Net Operating Margin",
      impact: "neutral",
      description: `Net operating margin of ${marginPct}% is moderate.`,
    });
    suggestions.push(
      "Improve net margin by increasing revenue per transaction or reducing variable costs."
    );
  } else {
    factors.push({
      factor: "Net Operating Margin",
      impact: "negative",
      description: `Net operating margin of ${marginPct}% is low, reducing buyer attractiveness.`,
    });
    suggestions.push(
      "A buyer will look for at least 15-25% operating margins. Focus on revenue growth and cost control."
    );
  }

  // Factor 4: EBITDA margin
  const ebitdaMargin =
    profitability.revenue.total > 0
      ? ebitda / profitability.revenue.total
      : 0;
  const ebitdaMarginPct = Math.round(ebitdaMargin * 100);
  if (ebitdaMargin > 0.3) {
    factors.push({
      factor: "EBITDA Margin",
      impact: "positive",
      description: `EBITDA margin of ${ebitdaMarginPct}% signals strong cash generation.`,
    });
  } else if (ebitdaMargin > 0.15) {
    factors.push({
      factor: "EBITDA Margin",
      impact: "neutral",
      description: `EBITDA margin of ${ebitdaMarginPct}% is within a typical range.`,
    });
  } else {
    factors.push({
      factor: "EBITDA Margin",
      impact: "negative",
      description: `EBITDA margin of ${ebitdaMarginPct}% may signal thin cash generation.`,
    });
  }

  // Factor 5: Debt level relative to earnings
  if (debtService > 0 && ebitda > 0) {
    const debtCoverageRatio = ebitda / debtService;
    if (debtCoverageRatio > 3) {
      factors.push({
        factor: "Debt Coverage",
        impact: "positive",
        description: `Debt service coverage ratio of ${debtCoverageRatio.toFixed(1)}x is healthy and attractive to buyers.`,
      });
    } else if (debtCoverageRatio > 1.5) {
      factors.push({
        factor: "Debt Coverage",
        impact: "neutral",
        description: `Debt service coverage ratio of ${debtCoverageRatio.toFixed(1)}x — adequate but could be improved.`,
      });
    } else {
      factors.push({
        factor: "Debt Coverage",
        impact: "negative",
        description: `Debt service coverage ratio of ${debtCoverageRatio.toFixed(1)}x is concerning. High debt reduces buyer interest.`,
      });
      suggestions.push(
        "Pay down existing debt before a sale to maximize valuation."
      );
    }
  } else if (debtService === 0) {
    factors.push({
      factor: "Debt Coverage",
      impact: "positive",
      description: "No significant debt service detected. The business is unencumbered.",
    });
  }

  // Factor 6: Revenue consistency (coefficient of variation)
  if (monthly.length >= 6) {
    const revenues = monthly.map((m) => m.revenue);
    const avgRev = revenues.reduce((s, r) => s + r, 0) / revenues.length;
    const variance =
      revenues.reduce((s, r) => s + Math.pow(r - avgRev, 2), 0) / revenues.length;
    const stdDev = Math.sqrt(variance);
    const cv = avgRev > 0 ? stdDev / avgRev : 0;

    if (cv < 0.15) {
      factors.push({
        factor: "Revenue Consistency",
        impact: "positive",
        description: "Monthly revenue is highly consistent, reducing perceived risk for buyers.",
      });
    } else if (cv < 0.3) {
      factors.push({
        factor: "Revenue Consistency",
        impact: "neutral",
        description: "Revenue has moderate variability month-to-month.",
      });
    } else {
      factors.push({
        factor: "Revenue Consistency",
        impact: "negative",
        description: "Revenue is highly variable, increasing perceived risk.",
      });
      suggestions.push(
        "Build recurring revenue streams and reduce dependence on seasonal spikes."
      );
    }
  }

  // Default suggestion if none generated
  if (suggestions.length === 0) {
    suggestions.push(
      "Continue maintaining strong financial metrics. Document systems and processes to reduce owner-dependence."
    );
  }

  return { factors, suggestions };
}

// ── Main Function ───────────────────────────────────────────────────────────

export async function calculateValuation(
  practiceId: string
): Promise<ValuationReport> {
  const now = new Date();
  const asOfDate = now;

  // Trailing 12-month window
  const startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // 1. Get profitability report for trailing 12 months
  const profitability = await calculateProfitability(
    practiceId,
    startDate,
    endDate
  );

  // 2. Estimate EBITDA addbacks (interest, depreciation/amortization, debt service)
  const addbacks = await estimateEbitdaAddbacks(practiceId, startDate, endDate);

  // 3. Compute EBITDA = NOI + D&A + interest expense
  // NOI already excludes owner compensation
  const noi = profitability.netOperatingIncome;
  const ebitda = noi + addbacks.depreciationAmortization + addbacks.interestExpense;

  // 4. Compute SDE = True Net Profit + Owner Compensation + discretionary (simplified)
  // SDE = Net Profit + Owner Comp (owner comp includes salary, draws, benefits)
  const sde = profitability.trueNetProfit + profitability.ownerCompensation;

  // 5. Load industry config for multipliers
  const config = await getConfigForPractice(practiceId);
  const multipliers = config.valuationMultipliers || DEFAULT_MULTIPLIERS;
  const overheadBenchmarkMax = config.benchmarks?.overheadRatio?.target?.[1] ?? 0.65;

  // 6. Apply multipliers
  const annualRevenue = profitability.revenue.total;
  const annualExpenses = profitability.operatingExpenses.total;

  const revenueMultiple: ValuationMultipleResult = {
    low: annualRevenue * multipliers.revenueMultiple.low,
    mid: annualRevenue * multipliers.revenueMultiple.mid,
    high: annualRevenue * multipliers.revenueMultiple.high,
    multiplier: { ...multipliers.revenueMultiple },
  };

  const ebitdaMultiple: ValuationMultipleResult = {
    low: ebitda * multipliers.ebitdaMultiple.low,
    mid: ebitda * multipliers.ebitdaMultiple.mid,
    high: ebitda * multipliers.ebitdaMultiple.high,
    multiplier: { ...multipliers.ebitdaMultiple },
  };

  const sdeMultiple: ValuationMultipleResult = {
    low: sde * multipliers.sdeMultiple.low,
    mid: sde * multipliers.sdeMultiple.mid,
    high: sde * multipliers.sdeMultiple.high,
    multiplier: { ...multipliers.sdeMultiple },
  };

  // 7. Blended estimated value = average of three mid values
  const estimatedValue =
    (revenueMultiple.mid + ebitdaMultiple.mid + sdeMultiple.mid) / 3;

  // Value range: lowest low to highest high
  const valueRange = {
    low: Math.min(revenueMultiple.low, ebitdaMultiple.low, sdeMultiple.low),
    high: Math.max(revenueMultiple.high, ebitdaMultiple.high, sdeMultiple.high),
  };

  // 8. Load historical snapshots for trend
  const snapshots = await db
    .select()
    .from(valuationSnapshots)
    .where(eq(valuationSnapshots.practiceId, practiceId))
    .orderBy(desc(valuationSnapshots.snapshotDate))
    .limit(20);

  const historicalValues: HistoricalValuationPoint[] = snapshots
    .reverse()
    .map((s) => {
      const revVal = parseFloat(s.revenueMultipleValue || "0");
      const ebitdaVal = parseFloat(s.ebitdaMultipleValue || "0");
      const sdeVal = parseFloat(s.sdeMultipleValue || "0");
      return {
        date: s.snapshotDate,
        estimatedValue: (revVal + ebitdaVal + sdeVal) / 3,
        revenue: parseFloat(s.annualRevenue || "0"),
        ebitda: parseFloat(s.ebitda || "0"),
      };
    });

  // 9. Analyze factors
  const { factors, suggestions } = analyzeFactors(
    profitability,
    ebitda,
    addbacks.debtService,
    overheadBenchmarkMax
  );

  return {
    asOfDate,
    industryName: config.name,
    annualRevenue,
    annualExpenses,
    ebitda,
    ownerCompensation: profitability.ownerCompensation,
    sde,
    interestExpense: addbacks.interestExpense,
    depreciationAmortization: addbacks.depreciationAmortization,
    revenueMultiple,
    ebitdaMultiple,
    sdeMultiple,
    estimatedValue,
    valueRange,
    historicalValues,
    factors,
    suggestions,
    disclaimer: DISCLAIMER,
  };
}

// ── Snapshot Persistence ────────────────────────────────────────────────────

export async function saveValuationSnapshot(
  practiceId: string
): Promise<void> {
  const report = await calculateValuation(practiceId);
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  await db.insert(valuationSnapshots).values({
    practiceId,
    snapshotDate: today,
    revenueMultipleValue: String(report.revenueMultiple.mid),
    ebitdaMultipleValue: String(report.ebitdaMultiple.mid),
    sdeMultipleValue: String(report.sdeMultiple.mid),
    revenueMultiplier: String(report.revenueMultiple.multiplier.mid),
    ebitdaMultiplier: String(report.ebitdaMultiple.multiplier.mid),
    sdeMultiplier: String(report.sdeMultiple.multiplier.mid),
    annualRevenue: String(report.annualRevenue),
    ebitda: String(report.ebitda),
    sde: String(report.sde),
  });
}

// ── History ─────────────────────────────────────────────────────────────────

export async function getValuationHistory(
  practiceId: string
): Promise<HistoricalValuationPoint[]> {
  const snapshots = await db
    .select()
    .from(valuationSnapshots)
    .where(eq(valuationSnapshots.practiceId, practiceId))
    .orderBy(desc(valuationSnapshots.snapshotDate))
    .limit(40);

  return snapshots.reverse().map((s) => {
    const revVal = parseFloat(s.revenueMultipleValue || "0");
    const ebitdaVal = parseFloat(s.ebitdaMultipleValue || "0");
    const sdeVal = parseFloat(s.sdeMultipleValue || "0");
    return {
      date: s.snapshotDate,
      estimatedValue: (revVal + ebitdaVal + sdeVal) / 3,
      revenue: parseFloat(s.annualRevenue || "0"),
      ebitda: parseFloat(s.ebitda || "0"),
    };
  });
}
