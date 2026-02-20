import { getOverheadStatus } from "./profitability";

export interface Insight {
  type: "info" | "warning" | "success";
  text: string;
}

export function generateInsights(data: {
  overheadRatio: number;
  excessCash: number;
  combinedFreeCash: number;
  cashRunwayMonths: number;
  topExpenseCategory?: { name: string; amount: number };
  trend?: "improving" | "stable" | "declining";
  seasonalDipMonth?: string;
  seasonalDipPct?: number;
}): Insight[] {
  const insights: Insight[] = [];
  const status = getOverheadStatus(data.overheadRatio);

  // Overhead ratio insight
  const pct = Math.round(data.overheadRatio * 100);
  if (status === "healthy") {
    insights.push({
      type: "success",
      text: `Your overhead ratio is ${pct}% — below the 55% benchmark. Excellent cost control.`,
    });
  } else if (status === "normal") {
    insights.push({
      type: "info",
      text: `Your overhead ratio is ${pct}% — within the healthy range for dental practices (55–65%).`,
    });
  } else if (status === "elevated") {
    insights.push({
      type: "warning",
      text: `Your overhead ratio is ${pct}% — above the 65% target. Review your top expense categories for savings.`,
    });
  } else {
    insights.push({
      type: "warning",
      text: `Your overhead ratio is ${pct}% — significantly above the 75% critical threshold. Immediate attention needed.`,
    });
  }

  // Excess cash / debt capacity
  if (data.excessCash > 0) {
    const debtCapacity = Math.round(data.excessCash * 120); // rough: monthly excess * 10yr * 12mo
    insights.push({
      type: "info",
      text: `You have $${Math.round(data.excessCash).toLocaleString()}/mo in excess free cash — enough to service approximately $${debtCapacity.toLocaleString()} in additional debt.`,
    });
  } else if (data.excessCash < 0) {
    insights.push({
      type: "warning",
      text: `Your monthly free cash is $${Math.round(Math.abs(data.excessCash)).toLocaleString()} below your reserve threshold. Consider reducing discretionary spending.`,
    });
  }

  // Cash runway
  if (data.cashRunwayMonths < 3) {
    insights.push({
      type: "warning",
      text: `Cash runway is ${data.cashRunwayMonths} months — below the 3-month safety threshold.`,
    });
  } else if (data.cashRunwayMonths >= 6) {
    insights.push({
      type: "success",
      text: `Cash runway is ${data.cashRunwayMonths} months — healthy liquidity position.`,
    });
  }

  // Top expense
  if (data.topExpenseCategory) {
    insights.push({
      type: "info",
      text: `Top expense category: ${data.topExpenseCategory.name} at $${data.topExpenseCategory.amount.toLocaleString()}/mo.`,
    });
  }

  // Trend
  if (data.trend === "improving") {
    insights.push({
      type: "success",
      text: "Cash flow is trending upward over the last 3 months.",
    });
  } else if (data.trend === "declining") {
    insights.push({
      type: "warning",
      text: "Cash flow is trending downward. Monitor closely over the next month.",
    });
  }

  // Seasonal dip warning
  if (data.seasonalDipMonth && data.seasonalDipPct) {
    insights.push({
      type: "info",
      text: `Cash flow typically dips in ${data.seasonalDipMonth}. Based on your pattern, expect a ${data.seasonalDipPct}% dip.`,
    });
  }

  return insights;
}
