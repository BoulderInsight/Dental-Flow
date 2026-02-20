import { db } from "@/lib/db";
import {
  transactions,
  categorizations,
  budgets,
} from "@/lib/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

export interface BudgetConfig {
  practiceId: string;
  year: number;
  categories: Array<{
    accountRef: string;
    monthlyTarget: number;
    annualTarget: number;
  }>;
}

export interface BudgetVsActual {
  categories: Array<{
    accountRef: string;
    monthlyTarget: number;
    monthlyActual: number;
    ytdTarget: number;
    ytdActual: number;
    variance: number;
    variancePercent: number;
    status: "under" | "on_track" | "over";
  }>;
  totalTarget: number;
  totalActual: number;
  totalVariance: number;
}

export interface SuggestedBudget {
  categories: Array<{
    accountRef: string;
    suggested: number;
    avgMonthly: number;
  }>;
}

const latestCatId = sql`(
  SELECT c.id FROM categorizations c
  WHERE c.transaction_id = ${transactions.id}
  ORDER BY c.created_at DESC LIMIT 1
)`;

export async function getSuggestedBudget(
  practiceId: string
): Promise<SuggestedBudget> {
  // Get trailing 3-month averages per accountRef
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  threeMonthsAgo.setDate(1);

  const rows = await db
    .select({
      accountRef: transactions.accountRef,
      total: sql<string>`sum(abs(${transactions.amount}::numeric))`,
      months: sql<number>`count(distinct to_char(${transactions.date}, 'YYYY-MM'))::int`,
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
        gte(transactions.date, threeMonthsAgo),
        sql`${transactions.amount}::numeric < 0` // expenses only
      )
    )
    .groupBy(transactions.accountRef);

  const categories = rows
    .filter((r) => r.accountRef)
    .map((r) => {
      const total = parseFloat(r.total);
      const monthCount = r.months || 1;
      const avgMonthly = total / monthCount;
      return {
        accountRef: r.accountRef!,
        suggested: Math.round(avgMonthly * 100) / 100,
        avgMonthly: Math.round(avgMonthly * 100) / 100,
      };
    })
    .sort((a, b) => b.suggested - a.suggested);

  return { categories };
}

export async function getBudget(
  practiceId: string,
  year: number
): Promise<BudgetConfig | null> {
  const rows = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.practiceId, practiceId), eq(budgets.year, year)));

  if (rows.length === 0) return null;

  return {
    practiceId,
    year,
    categories: rows.map((r) => ({
      accountRef: r.accountRef,
      monthlyTarget: parseFloat(r.monthlyTarget),
      annualTarget: parseFloat(r.monthlyTarget) * 12,
    })),
  };
}

export async function saveBudget(
  practiceId: string,
  year: number,
  categories: Array<{ accountRef: string; monthlyTarget: number }>
): Promise<void> {
  // Upsert budget entries
  for (const cat of categories) {
    const existing = await db
      .select({ id: budgets.id })
      .from(budgets)
      .where(
        and(
          eq(budgets.practiceId, practiceId),
          eq(budgets.year, year),
          eq(budgets.accountRef, cat.accountRef)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(budgets)
        .set({
          monthlyTarget: String(cat.monthlyTarget),
          updatedAt: new Date(),
        })
        .where(eq(budgets.id, existing[0].id));
    } else {
      await db.insert(budgets).values({
        practiceId,
        year,
        accountRef: cat.accountRef,
        monthlyTarget: String(cat.monthlyTarget),
      });
    }
  }
}

export async function calculateBudgetVsActual(
  practiceId: string,
  year: number,
  month?: number
): Promise<BudgetVsActual> {
  const budget = await getBudget(practiceId, year);
  if (!budget) {
    return {
      categories: [],
      totalTarget: 0,
      totalActual: 0,
      totalVariance: 0,
    };
  }

  // Current month or specified month
  const targetMonth = month || new Date().getMonth() + 1;
  const monthStart = new Date(year, targetMonth - 1, 1);
  const monthEnd = new Date(year, targetMonth, 0, 23, 59, 59);
  const yearStart = new Date(year, 0, 1);

  // Get actuals grouped by accountRef for the month
  const monthActuals = await db
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

  // YTD actuals
  const ytdActuals = await db
    .select({
      accountRef: transactions.accountRef,
      total: sql<string>`sum(abs(${transactions.amount}::numeric))`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.practiceId, practiceId),
        gte(transactions.date, yearStart),
        lte(transactions.date, monthEnd),
        sql`${transactions.amount}::numeric < 0`
      )
    )
    .groupBy(transactions.accountRef);

  const monthMap = new Map(
    monthActuals.map((r) => [r.accountRef, parseFloat(r.total)])
  );
  const ytdMap = new Map(
    ytdActuals.map((r) => [r.accountRef, parseFloat(r.total)])
  );

  let totalTarget = 0;
  let totalActual = 0;

  const categories = budget.categories.map((cat) => {
    const monthlyActual = monthMap.get(cat.accountRef) || 0;
    const ytdActual = ytdMap.get(cat.accountRef) || 0;
    const ytdTarget = cat.monthlyTarget * targetMonth;
    const variance = cat.monthlyTarget - monthlyActual;
    const variancePercent =
      cat.monthlyTarget > 0
        ? ((cat.monthlyTarget - monthlyActual) / cat.monthlyTarget) * 100
        : 0;

    let status: "under" | "on_track" | "over" = "on_track";
    if (monthlyActual < cat.monthlyTarget * 0.9) status = "under";
    else if (monthlyActual > cat.monthlyTarget * 1.1) status = "over";

    totalTarget += cat.monthlyTarget;
    totalActual += monthlyActual;

    return {
      accountRef: cat.accountRef,
      monthlyTarget: cat.monthlyTarget,
      monthlyActual: Math.round(monthlyActual * 100) / 100,
      ytdTarget: Math.round(ytdTarget * 100) / 100,
      ytdActual: Math.round(ytdActual * 100) / 100,
      variance: Math.round(variance * 100) / 100,
      variancePercent: Math.round(variancePercent * 10) / 10,
      status,
    };
  });

  return {
    categories,
    totalTarget: Math.round(totalTarget * 100) / 100,
    totalActual: Math.round(totalActual * 100) / 100,
    totalVariance: Math.round((totalTarget - totalActual) * 100) / 100,
  };
}
