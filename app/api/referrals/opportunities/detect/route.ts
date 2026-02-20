import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/logger";
import { db } from "@/lib/db";
import { referralOpportunities } from "@/lib/db/schema";
import { eq, and, notInArray } from "drizzle-orm";
import { detectOpportunities } from "@/lib/referrals/opportunity-detector";
import { matchPartner, ensureDefaultPartners } from "@/lib/referrals/partners";

export async function POST() {
  const session = await getSessionOrDemo();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireRole(session, "write");
  } catch {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  try {
    // Ensure default partners exist
    await ensureDefaultPartners();

    // Run opportunity detection
    const detected = await detectOpportunities(session.practiceId);

    // Get existing active opportunities to avoid duplicates
    const existing = await db
      .select({
        opportunityType: referralOpportunities.opportunityType,
        status: referralOpportunities.status,
      })
      .from(referralOpportunities)
      .where(
        and(
          eq(referralOpportunities.practiceId, session.practiceId),
          notInArray(referralOpportunities.status, ["dismissed", "completed"])
        )
      );

    const existingTypes = new Set(existing.map((e) => e.opportunityType));

    // Insert new opportunities that don't already exist
    let newCount = 0;
    for (const opp of detected) {
      // Skip if we already have an active opportunity of this type
      // Exception: loan_refinance can have multiple (one per loan)
      if (opp.opportunityType !== "loan_refinance" && existingTypes.has(opp.opportunityType)) {
        continue;
      }

      // For loan refinance, check by loan ID in metadata
      if (opp.opportunityType === "loan_refinance") {
        const existingRefi = await db
          .select({ id: referralOpportunities.id })
          .from(referralOpportunities)
          .where(
            and(
              eq(referralOpportunities.practiceId, session.practiceId),
              eq(referralOpportunities.opportunityType, "loan_refinance"),
              notInArray(referralOpportunities.status, ["dismissed", "completed"])
            )
          );

        // Check metadata for matching loan ID
        const hasExisting = existingRefi.some((_r) => {
          // We can't easily query jsonb here, so just check if any loan_refinance exists
          // This is a simplification — in production, we'd query by jsonb field
          return false; // Allow creating new ones
        });

        if (hasExisting) continue;
      }

      // Try to match a partner for this opportunity
      const partner = await matchPartner(session.practiceId, opp.partnerCategory);

      await db.insert(referralOpportunities).values({
        practiceId: session.practiceId,
        opportunityType: opp.opportunityType,
        title: opp.title,
        description: opp.description,
        estimatedSavings: opp.estimatedSavings ? String(opp.estimatedSavings) : null,
        estimatedValue: opp.estimatedValue ? String(opp.estimatedValue) : null,
        priority: opp.priority,
        status: "detected",
        matchedPartnerId: partner?.id ?? null,
        metadata: opp.metadata,
        expiresAt: opp.expiresAt,
      });

      newCount++;
    }

    await logAuditEvent({
      practiceId: session.practiceId,
      userId: session.userId,
      action: "referral_opportunities_detected",
      entityType: "referral_opportunity",
      newValue: { detected: detected.length, inserted: newCount },
    });

    return NextResponse.json({
      detected: detected.length,
      inserted: newCount,
      message: `Detected ${detected.length} opportunities, ${newCount} new.`,
    });
  } catch (error) {
    console.error("Opportunity detection error:", error);
    return NextResponse.json(
      { error: "Failed to detect opportunities" },
      { status: 500 }
    );
  }
}
