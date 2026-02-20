import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { calculateFreeCashFlow } from "@/lib/finance/cash-flow";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get("months") || "12", 10);

    const report = await calculateFreeCashFlow(
      session.practiceId,
      Math.min(months, 36)
    );

    return NextResponse.json(report);
  } catch (error) {
    console.error("Cash flow error:", error);
    return NextResponse.json(
      { error: "Failed to calculate cash flow" },
      { status: 500 }
    );
  }
}
