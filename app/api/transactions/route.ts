import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, categorizations } from "@/lib/db/schema";
import { eq, desc, asc, and, ilike, gte, lte, sql } from "drizzle-orm";
import { getSessionOrDemo } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const sortBy = searchParams.get("sortBy") || "date";
  const sortDir = searchParams.get("sortDir") || "desc";
  const category = searchParams.get("category");
  const vendor = searchParams.get("vendor");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const minConfidence = searchParams.get("minConfidence");
  const maxConfidence = searchParams.get("maxConfidence");

  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const resolvedPracticeId = session.practiceId;

    // Correlated subquery: get latest categorization per transaction
    const latestCatId = sql`(
      SELECT c.id FROM categorizations c
      WHERE c.transaction_id = transactions.id
      ORDER BY c.created_at DESC LIMIT 1
    )`;

    // Build WHERE conditions
    const conditions = [eq(transactions.practiceId, resolvedPracticeId)];

    if (vendor) {
      conditions.push(ilike(transactions.vendorName, `%${vendor}%`));
    }
    if (dateFrom) {
      conditions.push(gte(transactions.date, new Date(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lte(transactions.date, new Date(dateTo)));
    }
    // SQL-level category/confidence filtering
    if (category) {
      conditions.push(eq(categorizations.category, category as "business" | "personal" | "ambiguous"));
    }
    if (minConfidence) {
      conditions.push(gte(categorizations.confidence, parseInt(minConfidence)));
    }
    if (maxConfidence) {
      conditions.push(lte(categorizations.confidence, parseInt(maxConfidence)));
    }

    const where = and(...conditions);

    // Build the base query with latest-categorization join
    const baseFrom = db
      .select({
        id: transactions.id,
        practiceId: transactions.practiceId,
        qboTxnId: transactions.qboTxnId,
        date: transactions.date,
        amount: transactions.amount,
        vendorName: transactions.vendorName,
        description: transactions.description,
        accountRef: transactions.accountRef,
        syncedAt: transactions.syncedAt,
        categoryId: categorizations.id,
        category: categorizations.category,
        confidence: categorizations.confidence,
        catSource: categorizations.source,
        reasoning: categorizations.reasoning,
      })
      .from(transactions)
      .leftJoin(
        categorizations,
        and(
          eq(transactions.id, categorizations.transactionId),
          eq(categorizations.id, latestCatId)
        )
      );

    // Count query with same join + filters
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(transactions)
      .leftJoin(
        categorizations,
        and(
          eq(transactions.id, categorizations.transactionId),
          eq(categorizations.id, latestCatId)
        )
      )
      .where(where);

    // Data query
    const offset = (page - 1) * limit;
    const orderFn = sortDir === "asc" ? asc : desc;
    const orderCol =
      sortBy === "amount"
        ? transactions.amount
        : sortBy === "vendor"
          ? transactions.vendorName
          : sortBy === "confidence"
            ? categorizations.confidence
            : transactions.date;

    const txns = await baseFrom
      .where(where)
      .orderBy(orderFn(orderCol))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      transactions: txns,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Transactions query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}
