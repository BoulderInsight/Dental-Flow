import { db } from "@/lib/db";
import { retirementProfiles, retirementMilestones } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { calculateFreeCashFlow } from "./cash-flow";
import { calculateCostOfCapital } from "./cost-of-capital";
import { calculateValuation } from "./valuation";
import { calculateNetWorth } from "./net-worth";

// ── Types ───────────────────────────────────────────────────────────────────

export interface RoadmapSuggestion {
  id: string;
  title: string;
  description: string;
  category: "savings" | "debt" | "investment" | "practice" | "income";
  impact: "high" | "medium" | "low";
  estimatedMonthlyImpact: number;
  estimatedAnnualImpact: number;
  priority: number;
}

export interface Milestone {
  id: string;
  title: string;
  targetDate: string | null;
  estimatedCost: number | null;
  estimatedMonthlyIncome: number | null;
  category: string;
  status: string;
  notes: string | null;
  createdAt: string;
}

export interface RetirementRoadmap {
  suggestions: RoadmapSuggestion[];
  milestones: Milestone[];
  summary: {
    totalMonthlyImpact: number;
    totalAnnualImpact: number;
    excessMonthlyCash: number;
    totalDebt: number;
    practiceValue: number;
    currentNetWorth: number;
  };
}

// ── Main Function ───────────────────────────────────────────────────────────

export async function generateRoadmapSuggestions(
  practiceId: string
): Promise<RetirementRoadmap | null> {
  // Check profile exists
  const [profile] = await db
    .select()
    .from(retirementProfiles)
    .where(eq(retirementProfiles.practiceId, practiceId))
    .limit(1);

  if (!profile) return null;

  const suggestions: RoadmapSuggestion[] = [];
  let suggestionId = 0;

  // Pull financial data
  let excessMonthlyCash = 0;
  try {
    const cashFlow = await calculateFreeCashFlow(practiceId, 12);
    excessMonthlyCash = cashFlow.combined.excessCash;
  } catch {
    // Default to 0 if cash flow calc fails
  }

  let totalDebt = 0;
  let totalMonthlyDebtService = 0;
  try {
    const costOfCapital = await calculateCostOfCapital(practiceId);
    totalDebt = costOfCapital.totalDebt;
    totalMonthlyDebtService = costOfCapital.totalMonthlyDebtService;
  } catch {
    // Default to 0
  }

  let practiceValue = 0;
  try {
    const valuation = await calculateValuation(practiceId);
    practiceValue = valuation.estimatedValue;
  } catch {
    // Default to 0
  }

  let currentNetWorth = 0;
  try {
    const netWorth = await calculateNetWorth(practiceId);
    currentNetWorth = netWorth.netWorth;
  } catch {
    // Default to 0
  }

  const yearsToRetirement = Math.max(
    0,
    profile.targetRetirementAge - profile.currentAge
  );

  // ── Suggestion 1: Max out retirement contributions ──────────────────────
  const maxAnnual401k = 23500; // 2024 limit
  const catchUpAge = 50;
  const catchUp = profile.currentAge >= catchUpAge ? 7500 : 0;
  const maxTotal = maxAnnual401k + catchUp;
  const maxMonthly = Math.round(maxTotal / 12);

  suggestions.push({
    id: `suggestion-${++suggestionId}`,
    title: "Max Out Retirement Contributions",
    description: `Contribute $${maxMonthly.toLocaleString()}/mo to 401(k)${catchUp > 0 ? " (including catch-up)" : ""}. Annual limit: $${maxTotal.toLocaleString()}.`,
    category: "savings",
    impact: "high",
    estimatedMonthlyImpact: maxMonthly,
    estimatedAnnualImpact: maxTotal,
    priority: 1,
  });

  // ── Suggestion 2: Allocate excess cash to investments ───────────────────
  if (excessMonthlyCash > 500) {
    const investAmount = Math.round(excessMonthlyCash * 0.6);
    suggestions.push({
      id: `suggestion-${++suggestionId}`,
      title: "Invest Excess Free Cash",
      description: `You have ~$${Math.round(excessMonthlyCash).toLocaleString()}/mo in excess cash. Consider investing $${investAmount.toLocaleString()}/mo in a diversified portfolio.`,
      category: "investment",
      impact: "high",
      estimatedMonthlyImpact: investAmount,
      estimatedAnnualImpact: investAmount * 12,
      priority: 2,
    });
  }

  // ── Suggestion 3: Debt payoff acceleration ──────────────────────────────
  if (totalDebt > 0 && totalMonthlyDebtService > 0) {
    const extraPayment = Math.min(1000, Math.round(excessMonthlyCash * 0.3));
    if (extraPayment > 100) {
      suggestions.push({
        id: `suggestion-${++suggestionId}`,
        title: "Accelerate Debt Payoff",
        description: `Total debt: $${Math.round(totalDebt).toLocaleString()}. Adding $${extraPayment.toLocaleString()}/mo to highest-rate debt reduces total interest and frees up $${Math.round(totalMonthlyDebtService).toLocaleString()}/mo sooner.`,
        category: "debt",
        impact: totalDebt > 200000 ? "high" : "medium",
        estimatedMonthlyImpact: extraPayment,
        estimatedAnnualImpact: extraPayment * 12,
        priority: 3,
      });
    }
  }

  // ── Suggestion 4: Practice sale timing ──────────────────────────────────
  if (practiceValue > 0 && yearsToRetirement <= 15) {
    const saleProceeds = Math.round(practiceValue * 0.7);
    suggestions.push({
      id: `suggestion-${++suggestionId}`,
      title: "Plan Practice Sale Timeline",
      description: `Practice valued at ~$${Math.round(practiceValue).toLocaleString()}. A sale at retirement could yield ~$${saleProceeds.toLocaleString()} (after fees/taxes). Begin transition planning 3-5 years before target date.`,
      category: "practice",
      impact: "high",
      estimatedMonthlyImpact: 0,
      estimatedAnnualImpact: saleProceeds,
      priority: 4,
    });
  }

  // ── Suggestion 5: Rental or passive income ──────────────────────────────
  if (excessMonthlyCash > 2000) {
    const rentalTarget = 2000;
    suggestions.push({
      id: `suggestion-${++suggestionId}`,
      title: "Build Passive Income Stream",
      description: `Consider rental property or dividend-producing investments targeting $${rentalTarget.toLocaleString()}/mo in passive income to reduce dependence on practice income.`,
      category: "income",
      impact: "medium",
      estimatedMonthlyImpact: rentalTarget,
      estimatedAnnualImpact: rentalTarget * 12,
      priority: 5,
    });
  }

  // ── Suggestion 6: Backdoor Roth IRA ─────────────────────────────────────
  suggestions.push({
    id: `suggestion-${++suggestionId}`,
    title: "Contribute to Backdoor Roth IRA",
    description:
      "If income exceeds Roth limits, consider a backdoor Roth IRA for $7,000/year in tax-free growth. Consult your CPA for eligibility.",
    category: "savings",
    impact: "medium",
    estimatedMonthlyImpact: 583,
    estimatedAnnualImpact: 7000,
    priority: 6,
  });

  // ── Suggestion 7: HSA as retirement vehicle ─────────────────────────────
  suggestions.push({
    id: `suggestion-${++suggestionId}`,
    title: "Max HSA Contributions",
    description:
      "If you have an HDHP, maximize HSA contributions ($4,150 individual / $8,300 family). After 65, HSA funds can be used for any purpose.",
    category: "savings",
    impact: "low",
    estimatedMonthlyImpact: 692,
    estimatedAnnualImpact: 8300,
    priority: 7,
  });

  // Load milestones
  const milestoneRows = await db
    .select()
    .from(retirementMilestones)
    .where(eq(retirementMilestones.practiceId, practiceId))
    .orderBy(asc(retirementMilestones.targetDate));

  const milestones: Milestone[] = milestoneRows.map((m) => ({
    id: m.id,
    title: m.title,
    targetDate: m.targetDate,
    estimatedCost: m.estimatedCost ? parseFloat(m.estimatedCost) : null,
    estimatedMonthlyIncome: m.estimatedMonthlyIncome
      ? parseFloat(m.estimatedMonthlyIncome)
      : null,
    category: m.category,
    status: m.status,
    notes: m.notes,
    createdAt: m.createdAt.toISOString(),
  }));

  // Calculate totals
  const totalMonthlyImpact = suggestions.reduce(
    (sum, s) => sum + s.estimatedMonthlyImpact,
    0
  );
  const totalAnnualImpact = suggestions.reduce(
    (sum, s) => sum + s.estimatedAnnualImpact,
    0
  );

  return {
    suggestions: suggestions.sort((a, b) => a.priority - b.priority),
    milestones,
    summary: {
      totalMonthlyImpact,
      totalAnnualImpact,
      excessMonthlyCash: Math.round(excessMonthlyCash),
      totalDebt: Math.round(totalDebt),
      practiceValue: Math.round(practiceValue),
      currentNetWorth: Math.round(currentNetWorth),
    },
  };
}
