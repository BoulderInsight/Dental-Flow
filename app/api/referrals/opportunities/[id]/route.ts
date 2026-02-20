import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/logger";
import { db } from "@/lib/db";
import { referralOpportunities } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const VALID_STATUSES = ["detected", "viewed", "referred", "completed", "dismissed"];

export async function PUT(
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
    const body = await request.json();
    const { status } = body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = { status };

    if (status === "dismissed") {
      updateData.dismissedAt = new Date();
    } else if (status === "completed") {
      updateData.completedAt = new Date();
    }

    const [updated] = await db
      .update(referralOpportunities)
      .set(updateData)
      .where(
        and(
          eq(referralOpportunities.id, id),
          eq(referralOpportunities.practiceId, session.practiceId)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    await logAuditEvent({
      practiceId: session.practiceId,
      userId: session.userId,
      action: `referral_opportunity_${status}`,
      entityType: "referral_opportunity",
      entityId: id,
      newValue: { status },
    });

    return NextResponse.json({ opportunity: updated });
  } catch (error) {
    console.error("Update opportunity error:", error);
    return NextResponse.json(
      { error: "Failed to update opportunity" },
      { status: 500 }
    );
  }
}
