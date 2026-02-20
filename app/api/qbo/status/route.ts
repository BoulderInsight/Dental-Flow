import { NextResponse } from "next/server";
import { isDemoMode, getDemoStatus } from "@/lib/qbo/demo-mode";
import { db } from "@/lib/db";
import { practices } from "@/lib/db/schema";
import { isNotNull } from "drizzle-orm";

export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json(getDemoStatus());
  }

  // Check if any practice has tokens stored
  const [practice] = await db
    .select({ id: practices.id, name: practices.name })
    .from(practices)
    .where(isNotNull(practices.qboTokens))
    .limit(1);

  if (practice) {
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
