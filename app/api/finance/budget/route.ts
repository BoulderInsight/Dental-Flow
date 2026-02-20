import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import {
  getBudget,
  saveBudget,
  calculateBudgetVsActual,
  getSuggestedBudget,
} from "@/lib/finance/budget";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(
      searchParams.get("year") || String(new Date().getFullYear()),
      10
    );
    const month = searchParams.get("month")
      ? parseInt(searchParams.get("month")!, 10)
      : undefined;

    const budget = await getBudget(session.practiceId, year);

    if (!budget) {
      // Return suggested budget for first-time setup
      const suggested = await getSuggestedBudget(session.practiceId);
      return NextResponse.json({ budget: null, suggested, year });
    }

    const vsActual = await calculateBudgetVsActual(
      session.practiceId,
      year,
      month
    );

    return NextResponse.json({ budget, vsActual, year });
  } catch (error) {
    console.error("Budget error:", error);
    return NextResponse.json(
      { error: "Failed to load budget" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { year, categories } = body;

    if (!year || !categories || !Array.isArray(categories)) {
      return NextResponse.json(
        { error: "year and categories[] required" },
        { status: 400 }
      );
    }

    await saveBudget(session.practiceId, year, categories);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Budget save error:", error);
    return NextResponse.json(
      { error: "Failed to save budget" },
      { status: 500 }
    );
  }
}
