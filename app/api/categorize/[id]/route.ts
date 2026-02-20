import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { categorizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: transactionId } = await params;
    const body = await request.json();
    const { category, confidence = 100 } = body;

    if (!["business", "personal", "ambiguous"].includes(category)) {
      return NextResponse.json(
        { error: "Invalid category" },
        { status: 400 }
      );
    }

    // Delete existing categorization if any
    await db
      .delete(categorizations)
      .where(eq(categorizations.transactionId, transactionId));

    // Insert new user categorization
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

    return NextResponse.json(result);
  } catch (error) {
    console.error("Categorization update error:", error);
    return NextResponse.json(
      { error: "Failed to update categorization" },
      { status: 500 }
    );
  }
}
