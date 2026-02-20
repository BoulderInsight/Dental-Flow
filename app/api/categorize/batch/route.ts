import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { categorizations } from "@/lib/db/schema";
import { getSessionOrDemo } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/audit/logger";

const batchSchema = z.object({
  transactionIds: z.array(z.string().uuid()).min(1).max(200),
  category: z.enum(["business", "personal", "ambiguous"]),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = batchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { transactionIds, category } = parsed.data;

    // Insert categorization for each transaction (append-only)
    const values = transactionIds.map((transactionId) => ({
      transactionId,
      category: category as "business" | "personal" | "ambiguous",
      confidence: 100,
      source: "user" as const,
      reasoning: `Batch categorized as ${category} by user`,
    }));

    await db.insert(categorizations).values(values);

    // Audit log
    await logAuditEvent({
      practiceId: session.practiceId,
      userId: session.userId,
      action: "batch_categorize",
      entityType: "transaction",
      newValue: { category, count: transactionIds.length, transactionIds },
    });

    return NextResponse.json({
      categorized: transactionIds.length,
      category,
    });
  } catch (error) {
    console.error("Batch categorization error:", error);
    return NextResponse.json(
      { error: "Batch categorization failed" },
      { status: 500 }
    );
  }
}
