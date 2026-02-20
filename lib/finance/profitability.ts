import { db } from "@/lib/db";
import { transactions, categorizations } from "@/lib/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { getConfigForPractice } from "@/lib/industries";

export interface ProfitabilityReport {
  period: { start: Date; end: Date };
  revenue: {
    total: number;
    byCategory: Record<string, number>;
  };
  operatingExpenses: {
    total: number;
    byCategory: Record<string, number>;
  };
  overheadRatio: number;
  overheadStatus: "healthy" | "normal" | "elevated" | "critical";
  netOperatingIncome: number;
  ownerCompensation: number;
  trueNetProfit: number;
  monthlyBreakdown: MonthlyProfitability[];
}

export interface MonthlyProfitability {
  month: string;
  revenue: number;
  operatingExpenses: number;
  netOperatingIncome: number;
  overheadRatio: number;
}

const OWNER_ACCOUNT_REFS = [
  "owner's draw",
  "owner's personal",
  "distributions",
  "owner salary",
  "owner draw",
];

export function getOverheadStatus(
  ratio: number,
  benchmarks?: {
    overheadRatio: {
      healthy: number;
      target: [number, number];
      elevated: number;
      critical: number;
    };
  }
): "healthy" | "normal" | "elevated" | "critical" {
  const b = benchmarks?.overheadRatio;
  const healthyThreshold = b?.healthy ?? 0.55;
  const targetMax = b?.target?.[1] ?? 0.65;
  const elevatedThreshold = b?.elevated ?? 0.75;

  if (ratio < healthyThreshold) return "healthy";
  if (ratio <= targetMax) return "normal";
  if (ratio <= elevatedThreshold) return "elevated";
  return "critical";
}

// Latest categorization subquery for joining
const latestCatId = sql`(
  SELECT c.id FROM categorizations c
  WHERE c.transaction_id = ${transactions.id}
  ORDER BY c.created_at DESC LIMIT 1
)`;

export async function calculateProfitability(
  practiceId: string,
  startDate: Date,
  endDate: Date
): Promise<ProfitabilityReport> {
  // Get all transactions with their latest categorization for the period
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
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    );

  // Aggregate
  const revenueByCategory: Record<string, number> = {};
  const expenseByCategory: Record<string, number> = {};
  let totalRevenue = 0;
  let totalExpenses = 0;
  let ownerComp = 0;

  // Monthly aggregation
  const monthlyMap = new Map<
    string,
    { revenue: number; expenses: number }
  >();

  for (const row of rows) {
    const amount = parseFloat(row.amount);
    const accountRef = row.accountRef || "Uncategorized";
    const month = row.month;
    const isBusiness = row.category === "business";
    const isOwnerDraw =
      OWNER_ACCOUNT_REFS.includes(accountRef.toLowerCase());

    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, { revenue: 0, expenses: 0 });
    }
    const m = monthlyMap.get(month)!;

    if (amount > 0) {
      // Revenue
      totalRevenue += amount;
      revenueByCategory[accountRef] =
        (revenueByCategory[accountRef] || 0) + amount;
      m.revenue += amount;
    } else if (isBusiness || row.category === null) {
      const absAmount = Math.abs(amount);
      if (isOwnerDraw) {
        ownerComp += absAmount;
      } else {
        totalExpenses += absAmount;
        expenseByCategory[accountRef] =
          (expenseByCategory[accountRef] || 0) + absAmount;
        m.expenses += absAmount;
      }
    }
  }

  const overheadRatio = totalRevenue > 0 ? totalExpenses / totalRevenue : 0;
  const netOperatingIncome = totalRevenue - totalExpenses;
  const trueNetProfit = netOperatingIncome - ownerComp;

  // Load industry config for overhead benchmarks
  const config = await getConfigForPractice(practiceId);

  // Build monthly breakdown sorted by month
  const monthlyBreakdown: MonthlyProfitability[] = Array.from(
    monthlyMap.entries()
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      revenue: data.revenue,
      operatingExpenses: data.expenses,
      netOperatingIncome: data.revenue - data.expenses,
      overheadRatio: data.revenue > 0 ? data.expenses / data.revenue : 0,
    }));

  return {
    period: { start: startDate, end: endDate },
    revenue: { total: totalRevenue, byCategory: revenueByCategory },
    operatingExpenses: { total: totalExpenses, byCategory: expenseByCategory },
    overheadRatio,
    overheadStatus: getOverheadStatus(overheadRatio, config.benchmarks),
    netOperatingIncome,
    ownerCompensation: ownerComp,
    trueNetProfit,
    monthlyBreakdown,
  };
}
