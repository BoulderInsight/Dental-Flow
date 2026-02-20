import { calculateProfitability } from "./profitability";
import { calculateFreeCashFlow } from "./cash-flow";

export interface ScenarioAdjustments {
  revenueChangePct?: number;
  newExpenses?: Array<{ name: string; monthly: number }>;
  removedExpenses?: string[];
  newDebtService?: { monthly: number; months: number };
}

export interface ScenarioComparison {
  baseCase: ScenarioMetrics;
  scenario: ScenarioMetrics;
  deltas: ScenarioMetrics;
  summary: string;
}

export interface ScenarioMetrics {
  monthlyRevenue: number;
  monthlyExpenses: number;
  overheadRatio: number;
  netProfit: number;
  businessFreeCash: number;
  combinedFreeCash: number;
  cashRunwayMonths: number;
}

export async function runScenario(
  practiceId: string,
  adjustments: ScenarioAdjustments
): Promise<ScenarioComparison> {
  // Get base case from trailing 3 months
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 3);
  startDate.setDate(1);

  const profitability = await calculateProfitability(
    practiceId,
    startDate,
    endDate
  );
  const cashFlow = await calculateFreeCashFlow(practiceId, 3);

  const monthCount = profitability.monthlyBreakdown.length || 1;
  const baseRevenue = profitability.revenue.total / monthCount;
  const baseExpenses = profitability.operatingExpenses.total / monthCount;
  const baseOverhead = profitability.overheadRatio;
  const baseNetProfit = profitability.netOperatingIncome / monthCount;
  const baseBizFreeCash = cashFlow.business.freeCash / monthCount;
  const baseCombinedFreeCash =
    cashFlow.monthlyTrend.length > 0
      ? cashFlow.monthlyTrend
          .slice(-3)
          .reduce((s, m) => s + m.combinedFreeCash, 0) /
        Math.min(3, cashFlow.monthlyTrend.length)
      : 0;

  // Base case average monthly expenses for runway
  const baseMonthlyDebt = cashFlow.business.debtService / monthCount;
  const baseRunway =
    baseExpenses > 0
      ? Math.round((baseCombinedFreeCash / baseExpenses) * 10) / 10
      : 0;

  const baseCase: ScenarioMetrics = {
    monthlyRevenue: round(baseRevenue),
    monthlyExpenses: round(baseExpenses),
    overheadRatio: round(baseOverhead),
    netProfit: round(baseNetProfit),
    businessFreeCash: round(baseBizFreeCash),
    combinedFreeCash: round(baseCombinedFreeCash),
    cashRunwayMonths: Math.max(0, baseRunway),
  };

  // Apply scenario adjustments
  let scenarioRevenue = baseRevenue;
  let scenarioExpenses = baseExpenses;
  let scenarioDebt = baseMonthlyDebt;

  // Revenue change
  if (adjustments.revenueChangePct) {
    scenarioRevenue *= 1 + adjustments.revenueChangePct / 100;
  }

  // New expenses
  const newExpenseTotal = (adjustments.newExpenses || []).reduce(
    (s, e) => s + e.monthly,
    0
  );
  scenarioExpenses += newExpenseTotal;

  // Removed expenses
  if (adjustments.removedExpenses?.length) {
    for (const ref of adjustments.removedExpenses) {
      const categoryExpense =
        (profitability.operatingExpenses.byCategory[ref] || 0) / monthCount;
      scenarioExpenses -= categoryExpense;
    }
  }

  // New debt service
  if (adjustments.newDebtService) {
    scenarioDebt += adjustments.newDebtService.monthly;
  }

  const scenarioOverhead =
    scenarioRevenue > 0 ? scenarioExpenses / scenarioRevenue : 0;
  const scenarioNetProfit = scenarioRevenue - scenarioExpenses;
  const scenarioBizFreeCash = scenarioNetProfit - scenarioDebt;
  const scenarioCombinedFreeCash =
    scenarioBizFreeCash + (baseCombinedFreeCash - baseBizFreeCash); // keep personal constant
  const scenarioRunway =
    scenarioExpenses > 0
      ? Math.round((scenarioCombinedFreeCash / scenarioExpenses) * 10) / 10
      : 0;

  const scenario: ScenarioMetrics = {
    monthlyRevenue: round(scenarioRevenue),
    monthlyExpenses: round(scenarioExpenses),
    overheadRatio: round(scenarioOverhead),
    netProfit: round(scenarioNetProfit),
    businessFreeCash: round(scenarioBizFreeCash),
    combinedFreeCash: round(scenarioCombinedFreeCash),
    cashRunwayMonths: Math.max(0, scenarioRunway),
  };

  const deltas: ScenarioMetrics = {
    monthlyRevenue: round(scenario.monthlyRevenue - baseCase.monthlyRevenue),
    monthlyExpenses: round(scenario.monthlyExpenses - baseCase.monthlyExpenses),
    overheadRatio: round(scenario.overheadRatio - baseCase.overheadRatio),
    netProfit: round(scenario.netProfit - baseCase.netProfit),
    businessFreeCash: round(
      scenario.businessFreeCash - baseCase.businessFreeCash
    ),
    combinedFreeCash: round(
      scenario.combinedFreeCash - baseCase.combinedFreeCash
    ),
    cashRunwayMonths: round(
      scenario.cashRunwayMonths - baseCase.cashRunwayMonths
    ),
  };

  // Generate summary text
  const summary = generateSummary(baseCase, scenario, adjustments);

  return { baseCase, scenario, deltas, summary };
}

function generateSummary(
  base: ScenarioMetrics,
  scenario: ScenarioMetrics,
  adjustments: ScenarioAdjustments
): string {
  const parts: string[] = [];

  if (adjustments.newExpenses?.length) {
    const names = adjustments.newExpenses.map((e) => e.name).join(", ");
    const total = adjustments.newExpenses.reduce((s, e) => s + e.monthly, 0);
    parts.push(
      `Adding ${names} at $${total.toLocaleString()}/mo would ${
        scenario.combinedFreeCash < base.combinedFreeCash ? "reduce" : "increase"
      } your combined free cash from $${base.combinedFreeCash.toLocaleString()}/mo to $${scenario.combinedFreeCash.toLocaleString()}/mo.`
    );
  }

  if (adjustments.revenueChangePct) {
    const direction = adjustments.revenueChangePct > 0 ? "increase" : "decrease";
    parts.push(
      `A ${Math.abs(adjustments.revenueChangePct)}% revenue ${direction} would move net profit from $${base.netProfit.toLocaleString()}/mo to $${scenario.netProfit.toLocaleString()}/mo.`
    );
  }

  if (scenario.combinedFreeCash < 0 && base.combinedFreeCash > 0) {
    // Calculate breakeven revenue increase needed
    const deficit = Math.abs(scenario.combinedFreeCash);
    const pctNeeded =
      base.monthlyRevenue > 0
        ? Math.round((deficit / base.monthlyRevenue) * 100)
        : 0;
    parts.push(
      `You would need to increase revenue by approximately ${pctNeeded}% to break even.`
    );
  }

  if (scenario.cashRunwayMonths < 3) {
    parts.push(
      `Warning: Cash runway drops to ${scenario.cashRunwayMonths} months — below the 3-month safety threshold.`
    );
  }

  return parts.join(" ") || "No significant financial impact detected.";
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
