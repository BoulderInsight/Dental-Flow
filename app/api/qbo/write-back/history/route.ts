import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { getWriteBackHistory } from "@/lib/qbo/write-back";

export async function GET() {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const history = await getWriteBackHistory(session.practiceId);
    return NextResponse.json({ history });
  } catch (error) {
    console.error("Write-back history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch write-back history" },
      { status: 500 }
    );
  }
}
