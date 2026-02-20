import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/logger";
import { db } from "@/lib/db";
import { retirementProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [profile] = await db
      .select()
      .from(retirementProfiles)
      .where(eq(retirementProfiles.practiceId, session.practiceId))
      .limit(1);

    if (!profile) {
      return NextResponse.json({ profile: null });
    }

    return NextResponse.json({
      profile: {
        id: profile.id,
        currentAge: profile.currentAge,
        targetRetirementAge: profile.targetRetirementAge,
        desiredMonthlyIncome: parseFloat(profile.desiredMonthlyIncome),
        socialSecurityEstimate: parseFloat(
          profile.socialSecurityEstimate || "0"
        ),
        otherPensionIncome: parseFloat(profile.otherPensionIncome || "0"),
        riskTolerance: profile.riskTolerance,
        inflationRate: parseFloat(profile.inflationRate),
        expectedReturnRate: parseFloat(profile.expectedReturnRate),
      },
    });
  } catch (error) {
    console.error("Get retirement profile error:", error);
    return NextResponse.json(
      { error: "Failed to load retirement profile" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    requireRole(session, "write");

    const body = await request.json();
    const {
      currentAge,
      targetRetirementAge,
      desiredMonthlyIncome,
      socialSecurityEstimate = 0,
      otherPensionIncome = 0,
      riskTolerance = "moderate",
      inflationRate = 0.03,
      expectedReturnRate = 0.07,
    } = body;

    if (!currentAge || !targetRetirementAge || !desiredMonthlyIncome) {
      return NextResponse.json(
        { error: "currentAge, targetRetirementAge, and desiredMonthlyIncome are required" },
        { status: 400 }
      );
    }

    if (currentAge < 18 || currentAge > 100) {
      return NextResponse.json(
        { error: "currentAge must be between 18 and 100" },
        { status: 400 }
      );
    }

    if (
      targetRetirementAge <= currentAge ||
      targetRetirementAge > 100
    ) {
      return NextResponse.json(
        { error: "targetRetirementAge must be greater than currentAge and at most 100" },
        { status: 400 }
      );
    }

    // Check for existing profile
    const [existing] = await db
      .select({ id: retirementProfiles.id })
      .from(retirementProfiles)
      .where(eq(retirementProfiles.practiceId, session.practiceId))
      .limit(1);

    const values = {
      practiceId: session.practiceId,
      currentAge,
      targetRetirementAge,
      desiredMonthlyIncome: String(desiredMonthlyIncome),
      socialSecurityEstimate: String(socialSecurityEstimate),
      otherPensionIncome: String(otherPensionIncome),
      riskTolerance,
      inflationRate: String(inflationRate),
      expectedReturnRate: String(expectedReturnRate),
      updatedAt: new Date(),
    };

    let profileId: string;

    if (existing) {
      // Update
      await db
        .update(retirementProfiles)
        .set(values)
        .where(eq(retirementProfiles.id, existing.id));
      profileId = existing.id;
    } else {
      // Insert
      const [inserted] = await db
        .insert(retirementProfiles)
        .values(values)
        .returning({ id: retirementProfiles.id });
      profileId = inserted.id;
    }

    await logAuditEvent({
      practiceId: session.practiceId,
      userId: session.userId,
      action: existing ? "update" : "create",
      entityType: "retirement_profile",
      entityId: profileId,
      newValue: values,
    });

    return NextResponse.json({ success: true, id: profileId });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "PermissionError") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Upsert retirement profile error:", error);
    return NextResponse.json(
      { error: "Failed to save retirement profile" },
      { status: 500 }
    );
  }
}
