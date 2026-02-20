import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { requireRole, PermissionError } from "@/lib/auth/permissions";
import { runScenario } from "@/lib/finance/scenario";

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    requireRole(session, "write");

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
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Scenario error:", error);
    return NextResponse.json(
      { error: "Failed to run scenario" },
      { status: 500 }
    );
  }
}
