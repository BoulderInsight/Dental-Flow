import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { calculateRetirementProjection } from "@/lib/finance/retirement";

export async function GET() {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projection = await calculateRetirementProjection(session.practiceId);
    if (!projection) {
      return NextResponse.json({ hasProfile: false, projection: null });
    }

    return NextResponse.json({ hasProfile: true, projection });
  } catch (error) {
    console.error("Retirement projection error:", error);
    return NextResponse.json(
      { error: "Failed to calculate retirement projection" },
      { status: 500 }
    );
  }
}
