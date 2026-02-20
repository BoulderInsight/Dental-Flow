import { db } from "@/lib/db";
import {
  retirementProfiles,
  plaidAccounts,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateNetWorth } from "./net-worth";
import { calculateValuation } from "./valuation";

// ── Types ───────────────────────────────────────────────────────────────────

export interface RetirementProfile {
  id: string;
  currentAge: number;
  targetRetirementAge: number;
  desiredMonthlyIncome: number;
  socialSecurityEstimate: number;
  otherPensionIncome: number;
  riskTolerance: string;
  inflationRate: number;
  expectedReturnRate: number;
}

export interface YearProjection {
  year: number;
  age: number;
  startBalance: number;
  contributions: number;
  growth: number;
  endBalance: number;
}

export interface RetirementScenario {
  name: string;
  description: string;
  monthlyContribution: number;
  projectedBalance: number;
  readinessScore: number;
  yearByYear: YearProjection[];
  includePracticeSale: boolean;
  practiceSaleProceeds: number;
}

export interface RetirementProjection {
  profile: RetirementProfile;
  yearsToRetirement: number;
  currentRetirementBalance: number;
  currentNetWorth: number;
  practiceValue: number;
  monthlyIncomeGap: number;
  requiredNestEgg: number;
  readinessScore: number;
  passiveIncome: {
    desired: number;
    socialSecurity: number;
    pension: number;
    total: number;
    gap: number;
  };
  scenarios: RetirementScenario[];
  keyMetrics: {
    monthlyShortfall: number;
    progressPercent: number;
    targetDate: string;
  };
}

// ── Constants ───────────────────────────────────────────────────────────────

const SAFE_WITHDRAWAL_RATE = 0.04;
const RETIREMENT_SUBTYPES = [
  "401k",
  "ira",
  "roth",
  "retirement",
  "403b",
  "457b",
  "pension",
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function isRetirementAccount(subtype: string | null): boolean {
  if (!subtype) return false;
  const lower = subtype.toLowerCase();
  return RETIREMENT_SUBTYPES.some((rt) => lower.includes(rt));
}

/**
 * Calculate the nest egg required to fund the monthly income gap in retirement.
 * Inflates the income gap to retirement year, then divides by safe withdrawal rate.
 */
export function calculateRequiredNestEgg(
  monthlyIncomeGap: number,
  inflationRate: number,
  yearsToRetirement: number,
  safeWithdrawalRate: number = SAFE_WITHDRAWAL_RATE
): number {
  if (monthlyIncomeGap <= 0) return 0;
  const annualGap = monthlyIncomeGap * 12;
  const inflatedAnnualGap =
    annualGap * Math.pow(1 + inflationRate, yearsToRetirement);
  return inflatedAnnualGap / safeWithdrawalRate;
}

/**
 * Project compound growth of a balance with monthly contributions.
 * FV = PV * (1 + r/12)^(n*12) + PMT * [((1 + r/12)^(n*12) - 1) / (r/12)]
 */
export function projectCompoundGrowth(
  currentBalance: number,
  monthlyContribution: number,
  annualReturn: number,
  years: number
): number {
  const monthlyRate = annualReturn / 12;
  const totalMonths = years * 12;

  if (monthlyRate === 0) {
    return currentBalance + monthlyContribution * totalMonths;
  }

  const compoundedBalance =
    currentBalance * Math.pow(1 + monthlyRate, totalMonths);
  const futureValueOfContributions =
    monthlyContribution *
    ((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate);

  return compoundedBalance + futureValueOfContributions;
}

/**
 * Build a year-by-year projection table.
 */
function buildYearByYear(
  startBalance: number,
  monthlyContribution: number,
  annualReturn: number,
  years: number,
  currentAge: number,
  lumpSumAtEnd: number = 0
): YearProjection[] {
  const projections: YearProjection[] = [];
  let balance = startBalance;
  const monthlyRate = annualReturn / 12;

  for (let y = 1; y <= years; y++) {
    const startBal = balance;
    let yearContributions = 0;
    let yearGrowth = 0;

    for (let m = 0; m < 12; m++) {
      const interest = balance * monthlyRate;
      yearGrowth += interest;
      balance += interest + monthlyContribution;
      yearContributions += monthlyContribution;
    }

    // Add lump sum in the final year (e.g., practice sale)
    if (y === years && lumpSumAtEnd > 0) {
      balance += lumpSumAtEnd;
    }

    projections.push({
      year: y,
      age: currentAge + y,
      startBalance: Math.round(startBal),
      contributions: Math.round(yearContributions),
      growth: Math.round(yearGrowth),
      endBalance: Math.round(balance),
    });
  }

  return projections;
}

/**
 * Estimate current monthly contribution based on risk tolerance.
 * Uses the difference between expected return and a conservative estimate.
 */
function estimateMonthlyContributionFromRisk(
  riskTolerance: string
): number {
  // These are default estimates; actual contributions come from the profile
  switch (riskTolerance) {
    case "aggressive":
      return 3000;
    case "moderate":
      return 2000;
    case "conservative":
      return 1500;
    default:
      return 2000;
  }
}

// ── Main Function ───────────────────────────────────────────────────────────

export async function calculateRetirementProjection(
  practiceId: string
): Promise<RetirementProjection | null> {
  // 1. Load retirement profile
  const [profileRow] = await db
    .select()
    .from(retirementProfiles)
    .where(eq(retirementProfiles.practiceId, practiceId))
    .limit(1);

  if (!profileRow) return null;

  const profile: RetirementProfile = {
    id: profileRow.id,
    currentAge: profileRow.currentAge,
    targetRetirementAge: profileRow.targetRetirementAge,
    desiredMonthlyIncome: parseFloat(profileRow.desiredMonthlyIncome),
    socialSecurityEstimate: parseFloat(profileRow.socialSecurityEstimate || "0"),
    otherPensionIncome: parseFloat(profileRow.otherPensionIncome || "0"),
    riskTolerance: profileRow.riskTolerance,
    inflationRate: parseFloat(profileRow.inflationRate),
    expectedReturnRate: parseFloat(profileRow.expectedReturnRate),
  };

  const yearsToRetirement = Math.max(
    0,
    profile.targetRetirementAge - profile.currentAge
  );

  // 2. Pull net worth for total picture
  const netWorthReport = await calculateNetWorth(practiceId);

  // 3. Pull practice valuation
  let practiceValue = 0;
  try {
    const valuation = await calculateValuation(practiceId);
    practiceValue = valuation.estimatedValue;
  } catch {
    // If valuation fails, use estimated value from net worth
    practiceValue = netWorthReport.assets.practiceValue;
  }

  // 4. Get retirement account balances from Plaid
  const retirementAccounts = await db
    .select({
      currentBalance: plaidAccounts.currentBalance,
      subtype: plaidAccounts.subtype,
    })
    .from(plaidAccounts)
    .where(
      and(
        eq(plaidAccounts.practiceId, practiceId),
        eq(plaidAccounts.isIncludedInNetWorth, true)
      )
    );

  const currentRetirementBalance = retirementAccounts
    .filter((a) => a.subtype && isRetirementAccount(a.subtype))
    .reduce((sum, a) => sum + parseFloat(a.currentBalance), 0);

  // 5. Calculate passive income and gap
  const totalPassiveIncome =
    profile.socialSecurityEstimate + profile.otherPensionIncome;
  const monthlyIncomeGap = Math.max(
    0,
    profile.desiredMonthlyIncome - totalPassiveIncome
  );

  // 6. Calculate required nest egg
  const requiredNestEgg = calculateRequiredNestEgg(
    monthlyIncomeGap,
    profile.inflationRate,
    yearsToRetirement,
    SAFE_WITHDRAWAL_RATE
  );

  // 7. Estimate current monthly contribution
  const estimatedMonthlyContribution =
    estimateMonthlyContributionFromRisk(profile.riskTolerance);

  // 8. Build three scenarios
  const scenarios: RetirementScenario[] = [];

  // Scenario 1: Current Pace
  const currentPaceBalance = projectCompoundGrowth(
    currentRetirementBalance,
    estimatedMonthlyContribution,
    profile.expectedReturnRate,
    yearsToRetirement
  );
  const currentPaceReadiness =
    requiredNestEgg > 0
      ? Math.min(100, Math.round((currentPaceBalance / requiredNestEgg) * 100))
      : 100;

  scenarios.push({
    name: "Current Pace",
    description: `Continue saving $${estimatedMonthlyContribution.toLocaleString()}/mo at ${(profile.expectedReturnRate * 100).toFixed(0)}% return`,
    monthlyContribution: estimatedMonthlyContribution,
    projectedBalance: Math.round(currentPaceBalance),
    readinessScore: currentPaceReadiness,
    yearByYear: buildYearByYear(
      currentRetirementBalance,
      estimatedMonthlyContribution,
      profile.expectedReturnRate,
      yearsToRetirement,
      profile.currentAge
    ),
    includePracticeSale: false,
    practiceSaleProceeds: 0,
  });

  // Scenario 2: Accelerated (+$2,000/mo)
  const acceleratedContribution = estimatedMonthlyContribution + 2000;
  const acceleratedBalance = projectCompoundGrowth(
    currentRetirementBalance,
    acceleratedContribution,
    profile.expectedReturnRate,
    yearsToRetirement
  );
  const acceleratedReadiness =
    requiredNestEgg > 0
      ? Math.min(
          100,
          Math.round((acceleratedBalance / requiredNestEgg) * 100)
        )
      : 100;

  scenarios.push({
    name: "Accelerated",
    description: `Increase to $${acceleratedContribution.toLocaleString()}/mo (+$2,000)`,
    monthlyContribution: acceleratedContribution,
    projectedBalance: Math.round(acceleratedBalance),
    readinessScore: acceleratedReadiness,
    yearByYear: buildYearByYear(
      currentRetirementBalance,
      acceleratedContribution,
      profile.expectedReturnRate,
      yearsToRetirement,
      profile.currentAge
    ),
    includePracticeSale: false,
    practiceSaleProceeds: 0,
  });

  // Scenario 3: With Practice Sale (70% of valuation)
  const practiceSaleProceeds = Math.round(practiceValue * 0.7);
  const withSaleBalance =
    projectCompoundGrowth(
      currentRetirementBalance,
      estimatedMonthlyContribution,
      profile.expectedReturnRate,
      yearsToRetirement
    ) + practiceSaleProceeds;
  const withSaleReadiness =
    requiredNestEgg > 0
      ? Math.min(100, Math.round((withSaleBalance / requiredNestEgg) * 100))
      : 100;

  scenarios.push({
    name: "With Practice Sale",
    description: `Current pace + sell practice at retirement (70% of $${Math.round(practiceValue).toLocaleString()})`,
    monthlyContribution: estimatedMonthlyContribution,
    projectedBalance: Math.round(withSaleBalance),
    readinessScore: withSaleReadiness,
    yearByYear: buildYearByYear(
      currentRetirementBalance,
      estimatedMonthlyContribution,
      profile.expectedReturnRate,
      yearsToRetirement,
      profile.currentAge,
      practiceSaleProceeds
    ),
    includePracticeSale: true,
    practiceSaleProceeds,
  });

  // 9. Overall readiness score (based on current pace)
  const readinessScore = currentPaceReadiness;

  // 10. Key metrics
  const targetDate = new Date();
  targetDate.setFullYear(targetDate.getFullYear() + yearsToRetirement);

  const monthlyShortfall =
    requiredNestEgg > currentPaceBalance && yearsToRetirement > 0
      ? Math.round(
          (requiredNestEgg - currentRetirementBalance) /
            (yearsToRetirement * 12) -
            estimatedMonthlyContribution
        )
      : 0;

  const progressPercent =
    requiredNestEgg > 0
      ? Math.min(
          100,
          Math.round((currentRetirementBalance / requiredNestEgg) * 100)
        )
      : 100;

  return {
    profile,
    yearsToRetirement,
    currentRetirementBalance: Math.round(currentRetirementBalance),
    currentNetWorth: Math.round(netWorthReport.netWorth),
    practiceValue: Math.round(practiceValue),
    monthlyIncomeGap,
    requiredNestEgg: Math.round(requiredNestEgg),
    readinessScore,
    passiveIncome: {
      desired: profile.desiredMonthlyIncome,
      socialSecurity: profile.socialSecurityEstimate,
      pension: profile.otherPensionIncome,
      total: totalPassiveIncome,
      gap: monthlyIncomeGap,
    },
    scenarios,
    keyMetrics: {
      monthlyShortfall: Math.max(0, monthlyShortfall),
      progressPercent,
      targetDate: targetDate.toISOString().split("T")[0],
    },
  };
}
