import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { calculateProfitability } from "@/lib/finance/profitability";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    // Default to current month
    const now = new Date();
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = endDateParam
      ? new Date(endDateParam)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const report = await calculateProfitability(
      session.practiceId,
      startDate,
      endDate
    );

    return NextResponse.json(report);
  } catch (error) {
    console.error("Profitability error:", error);
    return NextResponse.json(
      { error: "Failed to calculate profitability" },
      { status: 500 }
    );
  }
}
