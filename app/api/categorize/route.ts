import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { practices } from "@/lib/db/schema";
import { categorizeUncategorized } from "@/lib/categorization/engine";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    let practiceId = body.practiceId as string | undefined;

    // If no practiceId, find first practice (demo mode convenience)
    if (!practiceId) {
      const [practice] = await db
        .select({ id: practices.id })
        .from(practices)
        .limit(1);
      if (!practice) {
        return NextResponse.json(
          { error: "No practice found" },
          { status: 404 }
        );
      }
      practiceId = practice.id;
    }

    const result = await categorizeUncategorized(practiceId);

    return NextResponse.json({
      ...result,
      message: `Categorized ${result.categorized} transactions, ${result.uncategorized} remain uncategorized`,
    });
  } catch (error) {
    console.error("Categorization error:", error);
    return NextResponse.json(
      { error: "Categorization failed" },
      { status: 500 }
    );
  }
}
