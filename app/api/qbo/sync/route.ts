import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "@/lib/qbo/demo-mode";
import { syncTransactions } from "@/lib/qbo/sync";
import { db } from "@/lib/db";
import { transactions, practices } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const practiceId = body.practiceId as string | undefined;

    if (isDemoMode()) {
      // In demo mode, just report what's already seeded
      const [practice] = await db.select().from(practices).limit(1);
      if (!practice) {
        return NextResponse.json(
          { error: "No practice found — run db:seed first" },
          { status: 404 }
        );
      }

      const [result] = await db
        .select({ count: count() })
        .from(transactions)
        .where(eq(transactions.practiceId, practice.id));

      return NextResponse.json({
        mode: "demo",
        practiceId: practice.id,
        transactionCount: result.count,
        message: "Demo mode — using seed data",
      });
    }

    if (!practiceId) {
      return NextResponse.json(
        { error: "practiceId required" },
        { status: 400 }
      );
    }

    const result = await syncTransactions(practiceId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "Sync failed" },
      { status: 500 }
    );
  }
}
