import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { categorizations } from "@/lib/db/schema";
import { getSessionOrDemo } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/audit/logger";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: transactionId } = await params;
    const body = await request.json();
    const { category, confidence = 100 } = body;

    if (!["business", "personal", "ambiguous"].includes(category)) {
      return NextResponse.json(
        { error: "Invalid category" },
        { status: 400 }
      );
    }

    // Append-only: insert new categorization row (latest by createdAt wins)
    const [result] = await db
      .insert(categorizations)
      .values({
        transactionId,
        category,
        confidence,
        source: "user",
        reasoning: `Manually categorized as ${category} by user`,
      })
      .returning();

    await logAuditEvent({
      practiceId: session.practiceId,
      userId: session.userId,
      action: "categorize",
      entityType: "transaction",
      entityId: transactionId,
      newValue: { category, confidence, source: "user" },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Categorization update error:", error);
    return NextResponse.json(
      { error: "Failed to update categorization" },
      { status: 500 }
    );
  }
}
