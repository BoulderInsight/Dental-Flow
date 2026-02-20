import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { calculateValuation } from "@/lib/finance/valuation";

export async function GET() {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const report = await calculateValuation(session.practiceId);
    return NextResponse.json(report);
  } catch (error) {
    console.error("Valuation error:", error);
    return NextResponse.json(
      { error: "Failed to calculate valuation" },
      { status: 500 }
    );
  }
}
