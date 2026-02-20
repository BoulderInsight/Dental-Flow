import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, categorizations, practices } from "@/lib/db/schema";
import { eq, desc, asc, and, ilike, gte, lte, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const practiceId = searchParams.get("practiceId");
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
    // If no practiceId, find first practice (demo mode convenience)
    let resolvedPracticeId = practiceId;
    if (!resolvedPracticeId) {
      const [practice] = await db.select({ id: practices.id }).from(practices).limit(1);
      if (!practice) {
        return NextResponse.json({ transactions: [], total: 0 });
      }
      resolvedPracticeId = practice.id;
    }

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

    const where = and(...conditions);

    // Get total count
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(transactions)
      .where(where);

    // Get transactions with their latest categorization
    const offset = (page - 1) * limit;
    const orderFn = sortDir === "asc" ? asc : desc;
    const orderCol =
      sortBy === "amount"
        ? transactions.amount
        : sortBy === "vendor"
          ? transactions.vendorName
          : transactions.date;

    const txns = await db
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
        // Latest categorization
        categoryId: categorizations.id,
        category: categorizations.category,
        confidence: categorizations.confidence,
        catSource: categorizations.source,
        reasoning: categorizations.reasoning,
      })
      .from(transactions)
      .leftJoin(
        categorizations,
        eq(transactions.id, categorizations.transactionId)
      )
      .where(where)
      .orderBy(orderFn(orderCol))
      .limit(limit)
      .offset(offset);

    // Post-filter by category/confidence if specified
    let filtered = txns;
    if (category) {
      filtered = filtered.filter((t) => t.category === category);
    }
    if (minConfidence) {
      filtered = filtered.filter(
        (t) => t.confidence !== null && t.confidence >= parseInt(minConfidence)
      );
    }
    if (maxConfidence) {
      filtered = filtered.filter(
        (t) => t.confidence === null || t.confidence <= parseInt(maxConfidence)
      );
    }

    return NextResponse.json({
      transactions: filtered,
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
