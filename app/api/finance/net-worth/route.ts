import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { calculateNetWorth } from "@/lib/finance/net-worth";

export async function GET() {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const report = await calculateNetWorth(session.practiceId);
    return NextResponse.json(report);
  } catch (error) {
    console.error("Net worth error:", error);
    return NextResponse.json(
      { error: "Failed to calculate net worth" },
      { status: 500 }
    );
  }
}
