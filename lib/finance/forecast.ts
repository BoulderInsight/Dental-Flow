import { db } from "@/lib/db";
import { transactions, categorizations, forecasts } from "@/lib/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import type { IndustryConfig } from "@/lib/industries/types";
import { getConfigForPractice } from "@/lib/industries";

export interface ForecastResult {
  historicalMonths: Array<{ month: string; actual: number }>;
  projectedMonths: Array<{
    month: string;
    predicted: number;
    lower80: number;
    upper80: number;
    lower95: number;
    upper95: number;
  }>;
  metrics: {
    cashRunwayMonths: number;
    projectedOverheadRatio: number;
    trend: "improving" | "stable" | "declining";
  };
  seasonalityIndices: number[];
}

// Default dental seasonality indices (kept for backward compatibility)
const DEFAULT_SEASONALITY: number[] = [
  1.05, // Jan - benefit reset
  1.0, // Feb
  1.02, // Mar
  1.0, // Apr
  0.98, // May
  0.9, // Jun - summer dip
  0.85, // Jul - summer low
  0.88, // Aug
  0.95, // Sep
  0.98, // Oct
  1.08, // Nov - year-end rush
  1.12, // Dec - insurance rush
];

// Holt-Winters triple exponential smoothing
function holtWinters(
  data: number[],
  alpha: number,
  beta: number,
  gamma: number,
  seasonLength: number,
  forecastPeriods: number,
  configSeasonality?: number[]
): { forecast: number[]; level: number; trend: number; seasonal: number[] } {
  const n = data.length;
  if (n < seasonLength * 2) {
    // Not enough data for full seasonal decomposition — use simple projection
    return simpleProjection(data, forecastPeriods, seasonLength, configSeasonality);
  }

  // Initialize level and trend from first two seasons
  let level = 0;
  for (let i = 0; i < seasonLength; i++) {
    level += data[i];
  }
  level /= seasonLength;

  let trend = 0;
  for (let i = 0; i < seasonLength; i++) {
    trend += (data[seasonLength + i] - data[i]) / seasonLength;
  }
  trend /= seasonLength;

  // Initialize seasonal indices
  const seasonal: number[] = new Array(seasonLength);
  for (let i = 0; i < seasonLength; i++) {
    seasonal[i] = data[i] / (level || 1);
  }

  // Track residuals for confidence intervals
  const residuals: number[] = [];

  // Smooth through the data
  for (let t = seasonLength; t < n; t++) {
    const seasonIdx = t % seasonLength;
    const prevLevel = level;

    // Update level
    level =
      alpha * (data[t] / (seasonal[seasonIdx] || 1)) +
      (1 - alpha) * (prevLevel + trend);

    // Update trend
    trend = beta * (level - prevLevel) + (1 - beta) * trend;

    // Update seasonal
    seasonal[seasonIdx] =
      gamma * (data[t] / (level || 1)) +
      (1 - gamma) * seasonal[seasonIdx];

    // Track residual for confidence interval
    const fitted = (prevLevel + trend) * seasonal[seasonIdx];
    residuals.push(data[t] - fitted);
  }

  // Forecast
  const forecast: number[] = [];
  for (let h = 1; h <= forecastPeriods; h++) {
    const seasonIdx = (n + h - 1) % seasonLength;
    forecast.push((level + h * trend) * seasonal[seasonIdx]);
  }

  return { forecast, level, trend, seasonal };
}

function simpleProjection(
  data: number[],
  periods: number,
  seasonLength: number,
  configSeasonality?: number[]
): { forecast: number[]; level: number; trend: number; seasonal: number[] } {
  const n = data.length;
  const avg = data.reduce((s, v) => s + v, 0) / n;

  // Simple linear trend
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += data[i];
    sumXY += i * data[i];
    sumX2 += i * i;
  }
  const trend = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
  const level = avg;

  // Use config seasonality if provided, otherwise fall back to default
  const seasonal = [...(configSeasonality || DEFAULT_SEASONALITY)];

  const forecast: number[] = [];
  for (let h = 1; h <= periods; h++) {
    const seasonIdx = (n + h - 1) % seasonLength;
    forecast.push((level + (n + h) * trend) * seasonal[seasonIdx]);
  }

  return { forecast, level, trend, seasonal };
}

function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

const latestCatId = sql`(
  SELECT c.id FROM categorizations c
  WHERE c.transaction_id = ${transactions.id}
  ORDER BY c.created_at DESC LIMIT 1
)`;

export async function calculateForecast(
  practiceId: string,
  forecastMonths: number = 6
): Promise<ForecastResult> {
  // Load practice's industry config for seasonality
  const industryConfig = await getConfigForPractice(practiceId);

  // Get 24 months of historical data
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 24);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      amount: transactions.amount,
      accountRef: transactions.accountRef,
      category: categorizations.category,
      month: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
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

  // Aggregate monthly net cash flow (business only)
  const monthlyMap = new Map<string, { revenue: number; expenses: number }>();

  for (const row of rows) {
    const amount = parseFloat(row.amount);
    const month = row.month;

    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, { revenue: 0, expenses: 0 });
    }
    const m = monthlyMap.get(month)!;

    // Only business transactions for forecast
    if (row.category === "personal") continue;

    if (amount > 0) {
      m.revenue += amount;
    } else {
      m.expenses += Math.abs(amount);
    }
  }

  // Sort months and build time series
  const sortedMonths = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b));

  const historicalMonths = sortedMonths.map(([month, d]) => ({
    month,
    actual: d.revenue - d.expenses,
  }));

  const timeSeries = historicalMonths.map((h) => h.actual);

  // Run Holt-Winters
  const alpha = 0.3;
  const beta = 0.1;
  const gamma = 0.3;
  const seasonLength = 12;

  const hwResult = holtWinters(
    timeSeries,
    alpha,
    beta,
    gamma,
    seasonLength,
    forecastMonths,
    industryConfig.seasonality
  );

  // Calculate sigma for confidence intervals
  const residuals: number[] = [];
  for (let i = seasonLength; i < timeSeries.length; i++) {
    const seasonIdx = i % seasonLength;
    const fitted =
      (hwResult.level + (i - timeSeries.length) * hwResult.trend) *
      hwResult.seasonal[seasonIdx];
    residuals.push(timeSeries[i] - fitted);
  }
  const sigma = calculateStdDev(residuals) || Math.abs(hwResult.level * 0.1);

  // Build projected months
  const lastMonth = sortedMonths[sortedMonths.length - 1]?.[0] || "2026-02";
  const [lastYear, lastMo] = lastMonth.split("-").map(Number);

  const projectedMonths = hwResult.forecast.map((predicted, i) => {
    const h = i + 1;
    const totalMonths = lastMo + h;
    const year = lastYear + Math.floor((totalMonths - 1) / 12);
    const mo = ((totalMonths - 1) % 12) + 1;
    const month = `${year}-${String(mo).padStart(2, "0")}`;

    const sigmaH = sigma * Math.sqrt(h);
    return {
      month,
      predicted: Math.round(predicted * 100) / 100,
      lower80: Math.round((predicted - 1.28 * sigmaH) * 100) / 100,
      upper80: Math.round((predicted + 1.28 * sigmaH) * 100) / 100,
      lower95: Math.round((predicted - 1.96 * sigmaH) * 100) / 100,
      upper95: Math.round((predicted + 1.96 * sigmaH) * 100) / 100,
    };
  });

  // Metrics
  const last3 = historicalMonths.slice(-3);
  const last6 = historicalMonths.slice(-6);
  const avg3mo =
    last3.length > 0
      ? last3.reduce((s, m) => s + m.actual, 0) / last3.length
      : 0;
  const avg6mo =
    last6.length > 0
      ? last6.reduce((s, m) => s + m.actual, 0) / last6.length
      : 0;

  let trendDirection: "improving" | "stable" | "declining" = "stable";
  if (avg3mo > avg6mo * 1.05) trendDirection = "improving";
  else if (avg3mo < avg6mo * 0.95) trendDirection = "declining";

  // Cash runway: current cash balance / avg monthly expenses
  const last3Expenses = sortedMonths
    .slice(-3)
    .map(([, d]) => d.expenses);
  const avgMonthlyExpenses =
    last3Expenses.length > 0
      ? last3Expenses.reduce((s, e) => s + e, 0) / last3Expenses.length
      : 1;
  const currentCashBalance = last3.length > 0 ? last3[last3.length - 1].actual : 0;
  const cashRunwayMonths =
    avgMonthlyExpenses > 0
      ? Math.round((currentCashBalance / avgMonthlyExpenses) * 10) / 10
      : 0;

  // Projected overhead: next 3 months average expenses / average revenue
  const projectedExpenseRatio =
    sortedMonths.length > 0
      ? sortedMonths.slice(-3).reduce((s, [, d]) => s + d.expenses, 0) /
        (sortedMonths.slice(-3).reduce((s, [, d]) => s + d.revenue, 0) || 1)
      : 0;

  // Store forecast in DB
  await db.insert(forecasts).values({
    practiceId,
    forecastDate: new Date(),
    periodMonths: forecastMonths,
    method: "holt-winters",
    parametersJson: { alpha, beta, gamma, seasonLength },
    resultsJson: { historicalMonths, projectedMonths },
  });

  return {
    historicalMonths,
    projectedMonths,
    metrics: {
      cashRunwayMonths: Math.max(0, cashRunwayMonths),
      projectedOverheadRatio: Math.round(projectedExpenseRatio * 10000) / 10000,
      trend: trendDirection,
    },
    seasonalityIndices: hwResult.seasonal,
  };
}
