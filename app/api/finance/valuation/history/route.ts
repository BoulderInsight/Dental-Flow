import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { getValuationHistory } from "@/lib/finance/valuation";

export async function GET() {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const history = await getValuationHistory(session.practiceId);
    return NextResponse.json({ history });
  } catch (error) {
    console.error("Valuation history error:", error);
    return NextResponse.json(
      { error: "Failed to load valuation history" },
      { status: 500 }
    );
  }
}
