import { NextResponse } from "next/server";
import { isDemoMode, getDemoStatus } from "@/lib/qbo/demo-mode";
import { db } from "@/lib/db";
import { practices } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionOrDemo } from "@/lib/auth/session";

export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json(getDemoStatus());
  }

  const session = await getSessionOrDemo();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [practice] = await db
    .select({ id: practices.id, name: practices.name, qboTokens: practices.qboTokens })
    .from(practices)
    .where(eq(practices.id, session.practiceId))
    .limit(1);

  if (practice?.qboTokens) {
    return NextResponse.json({
      connected: true,
      mode: "live",
      practiceId: practice.id,
      practiceName: practice.name,
    });
  }

  return NextResponse.json({
    connected: false,
    mode: "live",
    message: "Not connected to QuickBooks",
  });
}
