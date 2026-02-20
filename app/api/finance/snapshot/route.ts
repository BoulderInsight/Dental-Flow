import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { getOrRefreshSnapshot } from "@/lib/finance/snapshot";

export async function GET() {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const snapshot = await getOrRefreshSnapshot(session.practiceId);
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("Snapshot error:", error);
    return NextResponse.json(
      { error: "Failed to get financial snapshot" },
      { status: 500 }
    );
  }
}
