import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { runScenario } from "@/lib/finance/scenario";

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { adjustments } = body;

    if (!adjustments) {
      return NextResponse.json(
        { error: "adjustments object required" },
        { status: 400 }
      );
    }

    const result = await runScenario(session.practiceId, adjustments);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Scenario error:", error);
    return NextResponse.json(
      { error: "Failed to run scenario" },
      { status: 500 }
    );
  }
}
