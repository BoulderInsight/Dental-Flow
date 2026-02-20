import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { referralOpportunities, referralPartners } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { trackReferral, matchPartner } from "@/lib/referrals/partners";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionOrDemo();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireRole(session, "write");
  } catch {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { id } = await params;

  try {
    // Get the opportunity
    const [opportunity] = await db
      .select()
      .from(referralOpportunities)
      .where(
        and(
          eq(referralOpportunities.id, id),
          eq(referralOpportunities.practiceId, session.practiceId)
        )
      )
      .limit(1);

    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    if (opportunity.status === "referred" || opportunity.status === "completed") {
      return NextResponse.json(
        { error: "This opportunity has already been referred" },
        { status: 400 }
      );
    }

    // Determine partner: use body.partnerId if provided, otherwise match automatically
    let partnerId: string | null = null;

    try {
      const body = await request.json();
      partnerId = body.partnerId || null;
    } catch {
      // No body or invalid JSON — that's OK, we'll auto-match
    }

    if (!partnerId) {
      // Get partner category from opportunity metadata or type mapping
      const categoryMap: Record<string, string> = {
        loan_refinance: "lender",
        insurance_review: "insurance",
        tax_planning: "cpa",
        exit_planning: "broker",
        equipment_financing: "equipment_financing",
        financial_advisor: "financial_advisor",
        debt_consolidation: "lender",
      };
      const partnerCategory =
        categoryMap[opportunity.opportunityType] || "lender";
      const partner = await matchPartner(session.practiceId, partnerCategory);
      partnerId = partner?.id ?? null;
    }

    if (!partnerId) {
      return NextResponse.json(
        { error: "No matching partner found" },
        { status: 404 }
      );
    }

    // Verify partner exists
    const [partner] = await db
      .select()
      .from(referralPartners)
      .where(eq(referralPartners.id, partnerId))
      .limit(1);

    if (!partner) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    // Track the referral
    await trackReferral(id, partnerId, session.userId, session.practiceId);

    // Return updated opportunity with partner info
    const [updated] = await db
      .select()
      .from(referralOpportunities)
      .where(eq(referralOpportunities.id, id))
      .limit(1);

    return NextResponse.json({
      opportunity: updated,
      partner: {
        id: partner.id,
        name: partner.name,
        contactEmail: partner.contactEmail,
        contactPhone: partner.contactPhone,
        website: partner.website,
      },
    });
  } catch (error) {
    console.error("Referral creation error:", error);
    return NextResponse.json(
      { error: "Failed to create referral" },
      { status: 500 }
    );
  }
}
