import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { calculateDebtCapacity } from "@/lib/finance/debt-capacity";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetDSCR = searchParams.get("targetDSCR")
      ? parseFloat(searchParams.get("targetDSCR")!)
      : undefined;
    const marketRate = searchParams.get("marketRate")
      ? parseFloat(searchParams.get("marketRate")!)
      : undefined;

    const report = await calculateDebtCapacity(session.practiceId, {
      targetDSCR,
      marketRate,
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error("Debt capacity error:", error);
    return NextResponse.json(
      { error: "Failed to calculate debt capacity" },
      { status: 500 }
    );
  }
}
