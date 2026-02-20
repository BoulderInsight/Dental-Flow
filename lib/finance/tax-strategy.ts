import { db } from "@/lib/db";
import { transactions, categorizations, practices } from "@/lib/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { getConfigForPractice } from "@/lib/industries";
import { calculateProfitability } from "./profitability";

export interface TaxAlertData {
  type: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  potentialSavings?: number;
  deadline?: Date;
  actionItems: string[];
  metadata: Record<string, unknown>;
}

// Default combined tax rate estimate (federal + state + SE)
const ESTIMATED_TAX_RATE = 0.30;

// Retirement contribution limits (2025/2026 values)
const SEP_IRA_LIMIT = 69000;

// Threshold for entity structure review
const ENTITY_REVIEW_THRESHOLD = 200000;

// Threshold for equipment purchase alert
const EQUIPMENT_THRESHOLD = 5000;

// Latest categorization subquery
const latestCatId = sql`(
  SELECT c.id FROM categorizations c
  WHERE c.transaction_id = ${transactions.id}
  ORDER BY c.created_at DESC LIMIT 1
)`;

/**
 * Generate tax strategy alerts for a practice.
 * Analyzes YTD income, equipment purchases, retirement contributions,
 * real estate holdings, and estimated tax deadlines.
 */
export async function generateTaxAlerts(
  practiceId: string,
  taxYear?: number
): Promise<TaxAlertData[]> {
  const now = new Date();
  const year = taxYear || now.getFullYear();
  const isCurrentYear = year === now.getFullYear();
  const currentMonth = isCurrentYear ? now.getMonth() + 1 : 12; // 1-indexed

  // Period for the tax year
  const yearStart = new Date(year, 0, 1);
  const yearEnd = isCurrentYear ? now : new Date(year, 11, 31, 23, 59, 59);

  // Load industry config for tax defaults
  const config = await getConfigForPractice(practiceId);
  const taxDefaults = config.taxDefaults || {
    section179Limit: 1220000,
    bonusDepreciationRate: 0.4,
    estimatedTaxQuarters: ["04-15", "06-15", "09-15", "01-15"],
  };

  // Get YTD profitability
  const profitability = await calculateProfitability(
    practiceId,
    yearStart,
    yearEnd
  );

  // Scan transactions for equipment purchases and retirement contributions
  const transactionData = await getTransactionBreakdown(
    practiceId,
    yearStart,
    yearEnd
  );

  // Get practice info for real estate detection
  const [practice] = await db
    .select({
      realEstateValue: practices.realEstateValue,
      estimatedValue: practices.estimatedValue,
    })
    .from(practices)
    .where(eq(practices.id, practiceId))
    .limit(1);

  const alerts: TaxAlertData[] = [];

  // 1. Year-End Planning (Q4 trigger)
  const yearEndAlert = generateYearEndPlanningAlert(
    profitability,
    taxDefaults,
    year,
    currentMonth,
    isCurrentYear
  );
  if (yearEndAlert) alerts.push(yearEndAlert);

  // 2. Estimated Tax Payments (quarterly deadlines)
  const estimatedTaxAlerts = generateEstimatedTaxAlerts(
    profitability,
    taxDefaults,
    year,
    isCurrentYear,
    now
  );
  alerts.push(...estimatedTaxAlerts);

  // 3. Equipment Depreciation
  const equipmentAlert = generateEquipmentDepreciationAlert(
    transactionData.equipmentTotal,
    taxDefaults,
    year
  );
  if (equipmentAlert) alerts.push(equipmentAlert);

  // 4. Retirement Contribution Gap
  const retirementAlert = generateRetirementContributionAlert(
    transactionData.retirementContributions,
    profitability.netOperatingIncome,
    year,
    currentMonth,
    isCurrentYear
  );
  if (retirementAlert) alerts.push(retirementAlert);

  // 5. Cost Segregation Opportunity
  const costSegAlert = generateCostSegregationAlert(
    practice?.realEstateValue,
    year
  );
  if (costSegAlert) alerts.push(costSegAlert);

  // 6. Entity Structure Review
  const entityAlert = generateEntityStructureAlert(
    profitability.netOperatingIncome,
    year
  );
  if (entityAlert) alerts.push(entityAlert);

  return alerts;
}

/**
 * Scan transactions for equipment purchases and retirement contributions.
 */
async function getTransactionBreakdown(
  practiceId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  equipmentTotal: number;
  retirementContributions: number;
}> {
  const rows = await db
    .select({
      amount: transactions.amount,
      accountRef: transactions.accountRef,
      vendorName: transactions.vendorName,
      description: transactions.description,
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

  let equipmentTotal = 0;
  let retirementContributions = 0;

  const equipmentPatterns = [
    "equipment",
    "machinery",
    "furniture",
    "fixtures",
    "computers",
    "technology",
    "imaging",
    "x-ray",
    "xray",
    "scanner",
    "laser",
    "chair",
    "instruments",
  ];

  const retirementPatterns = [
    "401k",
    "401(k)",
    "ira",
    "sep-ira",
    "sep ira",
    "simple ira",
    "retirement",
    "pension",
    "roth",
    "403b",
    "403(b)",
    "profit sharing",
  ];

  for (const row of rows) {
    const amount = Math.abs(parseFloat(row.amount));
    const accountRef = (row.accountRef || "").toLowerCase();
    const vendorName = (row.vendorName || "").toLowerCase();
    const description = (row.description || "").toLowerCase();
    const searchText = `${accountRef} ${vendorName} ${description}`;

    // Detect equipment purchases (negative amounts = expenses)
    if (parseFloat(row.amount) < 0) {
      const isEquipment = equipmentPatterns.some((p) =>
        searchText.includes(p)
      );
      if (isEquipment) {
        equipmentTotal += amount;
      }

      // Detect retirement contributions
      const isRetirement = retirementPatterns.some((p) =>
        searchText.includes(p)
      );
      if (isRetirement) {
        retirementContributions += amount;
      }
    }
  }

  return { equipmentTotal, retirementContributions };
}

/**
 * Alert 1: Year-End Planning (October-December)
 */
function generateYearEndPlanningAlert(
  profitability: { netOperatingIncome: number; revenue: { total: number } },
  taxDefaults: { section179Limit: number; bonusDepreciationRate: number },
  year: number,
  currentMonth: number,
  isCurrentYear: boolean
): TaxAlertData | null {
  // Only generate for current year in Q4 (October-December)
  if (!isCurrentYear || currentMonth < 10) return null;

  const ytdIncome = profitability.netOperatingIncome;
  if (ytdIncome <= 0) return null;

  // Project full-year income
  const monthsElapsed = currentMonth;
  const projectedAnnualIncome = (ytdIncome / monthsElapsed) * 12;
  const estimatedTaxBill = projectedAnnualIncome * ESTIMATED_TAX_RATE;

  const section179Limit = taxDefaults.section179Limit;
  const bonusRate = Math.round(taxDefaults.bonusDepreciationRate * 100);

  // Potential savings from maxing Section 179 (limited by actual income)
  const maxDeduction = Math.min(section179Limit, projectedAnnualIncome * 0.5);
  const potentialSavings = maxDeduction * ESTIMATED_TAX_RATE;

  return {
    type: "year_end_planning",
    title: "Year-End Tax Planning Opportunity",
    description: `You have $${formatNumber(ytdIncome)} in net operating income YTD, projecting ~$${formatNumber(projectedAnnualIncome)} for ${year}. Your estimated tax liability is ~$${formatNumber(estimatedTaxBill)}. Consider these strategies before December 31.`,
    priority: "high",
    potentialSavings,
    deadline: new Date(year, 11, 31),
    actionItems: [
      `Purchase qualifying equipment under Section 179 (up to $${formatNumber(section179Limit)} deduction)`,
      `Take advantage of ${bonusRate}% bonus depreciation on new assets`,
      "Prepay deductible business expenses (rent, insurance, supplies) for up to 12 months",
      "Maximize retirement plan contributions before year-end",
      "Review accounts receivable for any bad debts to write off",
      "Consider deferring income to January if appropriate",
    ],
    metadata: {
      ytdIncome,
      projectedAnnualIncome,
      estimatedTaxBill,
      section179Limit,
      bonusDepreciationRate: taxDefaults.bonusDepreciationRate,
    },
  };
}

/**
 * Alert 2: Estimated Tax Payment deadlines
 */
function generateEstimatedTaxAlerts(
  profitability: { netOperatingIncome: number },
  taxDefaults: { estimatedTaxQuarters: string[] },
  year: number,
  isCurrentYear: boolean,
  now: Date
): TaxAlertData[] {
  const alerts: TaxAlertData[] = [];
  const ytdIncome = profitability.netOperatingIncome;

  if (ytdIncome <= 0) return alerts;

  // Project annual income and quarterly payment
  const projectedAnnual = isCurrentYear
    ? (ytdIncome / (now.getMonth() + 1)) * 12
    : ytdIncome;
  const annualTax = projectedAnnual * ESTIMATED_TAX_RATE;
  const quarterlyPayment = annualTax / 4;

  const quarterLabels = ["Q1", "Q2", "Q3", "Q4"];
  const quarters = taxDefaults.estimatedTaxQuarters;

  for (let i = 0; i < quarters.length; i++) {
    const [month, day] = quarters[i].split("-").map(Number);
    // Q4 payment (01-15) is due in January of the next year
    const dueYear = month === 1 && i === 3 ? year + 1 : year;
    const deadline = new Date(dueYear, month - 1, day);

    // Only show upcoming deadlines (within 30 days before, or past due in current year)
    if (isCurrentYear) {
      const daysUntil = Math.ceil(
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Show if within 30 days before deadline, or up to 7 days past due
      if (daysUntil < -7 || daysUntil > 30) continue;
    } else {
      // For past years, don't generate estimated tax alerts
      continue;
    }

    const daysUntil = Math.ceil(
      (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const isPastDue = daysUntil < 0;

    alerts.push({
      type: "estimated_tax_payment",
      title: isPastDue
        ? `${quarterLabels[i]} Estimated Tax Payment Overdue`
        : `${quarterLabels[i]} Estimated Tax Payment Due`,
      description: isPastDue
        ? `Your ${quarterLabels[i]} estimated tax payment of ~$${formatNumber(quarterlyPayment)} was due on ${formatDate(deadline)}. Late payments may incur penalties.`
        : `Your ${quarterLabels[i]} estimated tax payment of ~$${formatNumber(quarterlyPayment)} is due on ${formatDate(deadline)}. This is based on projected annual income of ~$${formatNumber(projectedAnnual)}.`,
      priority: "high",
      deadline,
      actionItems: [
        `Pay estimated tax of ~$${formatNumber(quarterlyPayment)} via IRS Direct Pay or EFTPS`,
        "Review your income projection to ensure payment accuracy",
        "Consider increasing payment if income has grown significantly",
        isPastDue
          ? "File and pay as soon as possible to minimize penalties"
          : "Set a calendar reminder for this payment",
      ].filter(Boolean),
      metadata: {
        quarter: quarterLabels[i],
        quarterIndex: i,
        projectedAnnualIncome: projectedAnnual,
        annualTaxEstimate: annualTax,
        quarterlyPayment,
        dueDate: deadline.toISOString(),
        daysUntilDue: daysUntil,
        isPastDue,
      },
    });
  }

  return alerts;
}

/**
 * Alert 3: Equipment Depreciation
 */
function generateEquipmentDepreciationAlert(
  equipmentTotal: number,
  taxDefaults: { section179Limit: number; bonusDepreciationRate: number },
  year: number
): TaxAlertData | null {
  if (equipmentTotal < EQUIPMENT_THRESHOLD) return null;

  const section179Limit = taxDefaults.section179Limit;
  const bonusRate = Math.round(taxDefaults.bonusDepreciationRate * 100);
  const deductible = Math.min(equipmentTotal, section179Limit);
  const potentialSavings = deductible * ESTIMATED_TAX_RATE;

  return {
    type: "equipment_depreciation",
    title: "Equipment Depreciation Opportunity",
    description: `You have purchased $${formatNumber(equipmentTotal)} in equipment this year. Section 179 allows deducting up to $${formatNumber(section179Limit)} in the first year, plus ${bonusRate}% bonus depreciation on additional qualifying assets.`,
    priority: "medium",
    potentialSavings,
    actionItems: [
      `Elect Section 179 deduction for up to $${formatNumber(deductible)} of equipment purchases`,
      `Apply ${bonusRate}% bonus depreciation on qualifying assets exceeding Section 179 limit`,
      "Ensure all equipment invoices and receipts are documented",
      "Consult your CPA about the most advantageous depreciation method for your situation",
      "Consider timing additional equipment purchases before year-end if beneficial",
    ],
    metadata: {
      equipmentPurchasesYTD: equipmentTotal,
      section179Limit,
      bonusDepreciationRate: taxDefaults.bonusDepreciationRate,
      maxFirstYearDeduction: deductible,
      year,
    },
  };
}

/**
 * Alert 4: Retirement Contribution Gap
 */
function generateRetirementContributionAlert(
  retirementContributions: number,
  netOperatingIncome: number,
  year: number,
  currentMonth: number,
  isCurrentYear: boolean
): TaxAlertData | null {
  // Only check quarterly during current year
  if (isCurrentYear && currentMonth % 3 !== 0 && currentMonth !== 12)
    return null;

  // For past years, always show if there's a gap
  const maxContribution = SEP_IRA_LIMIT;
  const remaining = maxContribution - retirementContributions;

  // If they have already maxed out or are close, no alert needed
  if (remaining <= 1000) return null;

  // If income is too low to justify maxing retirement, adjust message
  // SEP-IRA max is 25% of net self-employment income
  const sepMaxBasedOnIncome = netOperatingIncome * 0.25;
  const effectiveMax = Math.min(maxContribution, sepMaxBasedOnIncome);
  const effectiveRemaining = Math.max(0, effectiveMax - retirementContributions);

  if (effectiveRemaining <= 1000) return null;

  const potentialSavings = effectiveRemaining * ESTIMATED_TAX_RATE;
  const contributionPct =
    effectiveMax > 0
      ? Math.round((retirementContributions / effectiveMax) * 100)
      : 0;

  return {
    type: "retirement_contribution_gap",
    title: "Retirement Contribution Opportunity",
    description: `You have contributed $${formatNumber(retirementContributions)} to retirement accounts this year (${contributionPct}% of your effective maximum). You have ~$${formatNumber(effectiveRemaining)} of contribution room remaining, which could reduce your tax bill by ~$${formatNumber(potentialSavings)}.`,
    priority: "medium",
    potentialSavings,
    deadline: isCurrentYear ? new Date(year, 11, 31) : undefined,
    actionItems: [
      `Contribute up to $${formatNumber(effectiveRemaining)} more to retirement accounts this year`,
      `SEP-IRA deadline: tax filing deadline (including extensions) for ${year}`,
      `Solo 401(k) employee contributions due by Dec 31, ${year}; employer contributions due by tax filing deadline`,
      "Consider catch-up contributions if age 50 or older",
      "Consult your CPA about the best retirement plan structure for your practice",
    ],
    metadata: {
      contributionsYTD: retirementContributions,
      sepIraLimit: maxContribution,
      effectiveMax,
      remainingRoom: effectiveRemaining,
      contributionPercentage: contributionPct,
      year,
    },
  };
}

/**
 * Alert 5: Cost Segregation Opportunity
 */
function generateCostSegregationAlert(
  realEstateValue: string | null | undefined,
  year: number
): TaxAlertData | null {
  const value = realEstateValue ? parseFloat(realEstateValue) : 0;
  if (value <= 0) return null;

  // Rough estimate: cost segregation typically accelerates 20-40% of building value
  const acceleratedPortion = value * 0.3;
  const potentialSavings = acceleratedPortion * ESTIMATED_TAX_RATE;

  return {
    type: "cost_segregation",
    title: "Cost Segregation Study Opportunity",
    description: `You own commercial real estate valued at ~$${formatNumber(value)}. A cost segregation study could reclassify building components into shorter depreciation periods, potentially accelerating ~$${formatNumber(acceleratedPortion)} in deductions.`,
    priority: "medium",
    potentialSavings,
    actionItems: [
      "Commission a cost segregation study from a qualified engineering firm",
      "Review your building purchase date and existing depreciation schedule",
      "Evaluate whether a look-back study (for properties acquired in prior years) makes sense",
      "Ask your CPA about the interaction with bonus depreciation rules",
      "Consider timing relative to any planned renovations or improvements",
    ],
    metadata: {
      realEstateValue: value,
      estimatedAcceleratedDepreciation: acceleratedPortion,
      year,
    },
  };
}

/**
 * Alert 6: Entity Structure Review
 */
function generateEntityStructureAlert(
  netOperatingIncome: number,
  year: number
): TaxAlertData | null {
  if (netOperatingIncome < ENTITY_REVIEW_THRESHOLD) return null;

  // Potential savings from S-Corp election: self-employment tax savings
  // SE tax is ~15.3% on income above reasonable salary
  const reasonableSalary = Math.min(netOperatingIncome * 0.6, 200000);
  const distributionAmount = netOperatingIncome - reasonableSalary;
  const potentialSavings =
    distributionAmount > 0 ? distributionAmount * 0.153 : 0;

  return {
    type: "entity_structure_review",
    title: "Business Entity Structure Review Recommended",
    description: `Based on your net operating income of $${formatNumber(netOperatingIncome)}, you may benefit from reviewing your business entity structure. An S-Corp election could save ~$${formatNumber(potentialSavings)}/year in self-employment taxes.`,
    priority: "low",
    potentialSavings,
    actionItems: [
      "Schedule a consultation with your CPA to review entity options",
      "Compare tax liability under current structure vs. S-Corp vs. C-Corp",
      "Evaluate reasonable salary requirements for S-Corp officer compensation",
      `S-Corp election deadline: March 15 of the tax year (Form 2553) — for ${year + 1}, file by March 15, ${year + 1}`,
      "Consider state-level implications (state tax treatment varies)",
      "Factor in additional compliance costs (payroll, separate tax return)",
    ],
    metadata: {
      netOperatingIncome,
      estimatedReasonableSalary: reasonableSalary,
      estimatedDistributionAmount: distributionAmount,
      selfEmploymentTaxSavings: potentialSavings,
      year,
    },
  };
}

// --- Formatting helpers ---

function formatNumber(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
