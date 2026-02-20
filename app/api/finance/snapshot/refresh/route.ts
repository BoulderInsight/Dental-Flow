import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { refreshSnapshot } from "@/lib/finance/snapshot";

export async function POST() {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const snapshot = await refreshSnapshot(session.practiceId);
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("Snapshot refresh error:", error);
    return NextResponse.json(
      { error: "Failed to refresh financial snapshot" },
      { status: 500 }
    );
  }
}
