import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { referralOpportunities } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await getSessionOrDemo();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const opportunities = await db
    .select()
    .from(referralOpportunities)
    .where(eq(referralOpportunities.practiceId, session.practiceId))
    .orderBy(desc(referralOpportunities.createdAt));

  return NextResponse.json({ opportunities });
}
