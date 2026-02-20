import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, categorizations, practices } from "@/lib/db/schema";
import { eq, and, sql, gte } from "drizzle-orm";
import { getSessionOrDemo } from "@/lib/auth/session";

export async function GET() {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const practiceId = session.practiceId;

    // Latest categorization subquery
    const latestCatId = sql`(
      SELECT c.id FROM categorizations c
      WHERE c.transaction_id = transactions.id
      ORDER BY c.created_at DESC LIMIT 1
    )`;

    // Total transactions
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(transactions)
      .where(eq(transactions.practiceId, practiceId));

    // Categorized / needs review / uncategorized
    const stats = await db
      .select({
        category: categorizations.category,
        confidence: categorizations.confidence,
        cnt: sql<number>`count(*)::int`,
      })
      .from(transactions)
      .leftJoin(
        categorizations,
        and(
          eq(transactions.id, categorizations.transactionId),
          eq(categorizations.id, latestCatId)
        )
      )
      .where(eq(transactions.practiceId, practiceId))
      .groupBy(categorizations.category, categorizations.confidence);

    let categorized = 0;
    let needsReview = 0;
    let uncategorized = 0;

    for (const row of stats) {
      if (row.category === null) {
        uncategorized += row.cnt;
      } else if (
        row.category === "ambiguous" ||
        (row.confidence !== null && row.confidence < 70)
      ) {
        needsReview += row.cnt;
      } else {
        categorized += row.cnt;
      }
    }

    // QBO connection check
    const [practice] = await db
      .select({ qboTokens: practices.qboTokens })
      .from(practices)
      .where(eq(practices.id, practiceId))
      .limit(1);
    const qboConnected = !!practice?.qboTokens;

    // Monthly cash flow (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlyCashFlow = await db
      .select({
        month: sql<string>`to_char(date, 'YYYY-MM')`,
        income: sql<string>`coalesce(sum(case when amount::numeric > 0 then amount::numeric else 0 end), 0)::text`,
        expenses: sql<string>`coalesce(sum(case when amount::numeric < 0 then abs(amount::numeric) else 0 end), 0)::text`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.practiceId, practiceId),
          gte(transactions.date, twelveMonthsAgo)
        )
      )
      .groupBy(sql`to_char(date, 'YYYY-MM')`)
      .orderBy(sql`to_char(date, 'YYYY-MM')`);

    // Top categories by accountRef
    const topCategories = await db
      .select({
        accountRef: transactions.accountRef,
        total: sql<string>`sum(abs(amount::numeric))::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(transactions)
      .where(eq(transactions.practiceId, practiceId))
      .groupBy(transactions.accountRef)
      .orderBy(sql`sum(abs(amount::numeric)) desc`)
      .limit(10);

    return NextResponse.json({
      totalTransactions: total,
      categorized,
      needsReview,
      uncategorized,
      qboConnected,
      monthlyCashFlow,
      topCategories,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard data" },
      { status: 500 }
    );
  }
}
