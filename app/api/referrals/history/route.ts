import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { referralOpportunities, referralPartners } from "@/lib/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";

export async function GET() {
  const session = await getSessionOrDemo();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get referred and completed opportunities with partner info
  const opportunities = await db
    .select({
      id: referralOpportunities.id,
      opportunityType: referralOpportunities.opportunityType,
      title: referralOpportunities.title,
      description: referralOpportunities.description,
      estimatedSavings: referralOpportunities.estimatedSavings,
      estimatedValue: referralOpportunities.estimatedValue,
      priority: referralOpportunities.priority,
      status: referralOpportunities.status,
      referredAt: referralOpportunities.referredAt,
      completedAt: referralOpportunities.completedAt,
      metadata: referralOpportunities.metadata,
      createdAt: referralOpportunities.createdAt,
      partnerName: referralPartners.name,
      partnerCategory: referralPartners.category,
      partnerEmail: referralPartners.contactEmail,
      partnerWebsite: referralPartners.website,
    })
    .from(referralOpportunities)
    .leftJoin(
      referralPartners,
      eq(referralOpportunities.matchedPartnerId, referralPartners.id)
    )
    .where(
      and(
        eq(referralOpportunities.practiceId, session.practiceId),
        inArray(referralOpportunities.status, ["referred", "completed"])
      )
    )
    .orderBy(desc(referralOpportunities.referredAt));

  return NextResponse.json({ history: opportunities });
}
