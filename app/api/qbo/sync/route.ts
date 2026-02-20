import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/qbo/demo-mode";
import { syncTransactions } from "@/lib/qbo/sync";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { getSessionOrDemo } from "@/lib/auth/session";

export async function POST() {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (isDemoMode()) {
      const [result] = await db
        .select({ count: count() })
        .from(transactions)
        .where(eq(transactions.practiceId, session.practiceId));

      return NextResponse.json({
        mode: "demo",
        practiceId: session.practiceId,
        transactionCount: result.count,
        message: "Demo mode — using seed data",
      });
    }

    const result = await syncTransactions(session.practiceId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "Sync failed" },
      { status: 500 }
    );
  }
}
