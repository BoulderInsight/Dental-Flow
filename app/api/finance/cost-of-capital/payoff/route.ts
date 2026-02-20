import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { calculateCostOfCapital } from "@/lib/finance/cost-of-capital";

/**
 * POST /api/finance/cost-of-capital/payoff
 * Accept custom payoff parameters (extra monthly payment amount).
 * Returns the full cost-of-capital report recalculated with the custom extra.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { extraMonthlyPayment } = body;

    if (
      extraMonthlyPayment === undefined ||
      typeof extraMonthlyPayment !== "number" ||
      extraMonthlyPayment < 0
    ) {
      return NextResponse.json(
        { error: "extraMonthlyPayment must be a non-negative number" },
        { status: 400 }
      );
    }

    const report = await calculateCostOfCapital(
      session.practiceId,
      extraMonthlyPayment
    );

    return NextResponse.json(report);
  } catch (error) {
    console.error("Payoff scenario error:", error);
    return NextResponse.json(
      { error: "Failed to calculate payoff scenario" },
      { status: 500 }
    );
  }
}
