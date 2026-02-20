import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { calculateCostOfCapital } from "@/lib/finance/cost-of-capital";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const extraMonthlyPayment = searchParams.get("extraMonthlyPayment")
      ? parseFloat(searchParams.get("extraMonthlyPayment")!)
      : undefined;

    const report = await calculateCostOfCapital(
      session.practiceId,
      extraMonthlyPayment
    );

    return NextResponse.json(report);
  } catch (error) {
    console.error("Cost of capital error:", error);
    return NextResponse.json(
      { error: "Failed to calculate cost of capital" },
      { status: 500 }
    );
  }
}
