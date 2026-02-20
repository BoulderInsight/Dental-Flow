import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { detectLoans } from "@/lib/finance/loans";

export async function POST() {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const detected = await detectLoans(session.practiceId);

    return NextResponse.json({ detected });
  } catch (error) {
    console.error("Loan detection error:", error);
    return NextResponse.json(
      { error: "Failed to detect loans" },
      { status: 500 }
    );
  }
}
