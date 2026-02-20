import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { generateCFOBriefing } from "@/lib/finance/cfo-briefing";

export async function GET() {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const briefing = await generateCFOBriefing(session.practiceId);
    return NextResponse.json(briefing);
  } catch (error) {
    console.error("CFO briefing error:", error);
    return NextResponse.json(
      { error: "Failed to generate briefing" },
      { status: 500 }
    );
  }
}
