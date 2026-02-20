import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { createLinkToken } from "@/lib/plaid/client";

export async function POST() {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const linkToken = await createLinkToken(session.userId, session.practiceId);
    return NextResponse.json({ linkToken });
  } catch (error) {
    console.error("Plaid link token error:", error);
    return NextResponse.json(
      { error: "Failed to create link token" },
      { status: 500 }
    );
  }
}
