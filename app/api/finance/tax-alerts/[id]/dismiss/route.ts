import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taxAlerts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionOrDemo } from "@/lib/auth/session";
import { requireRole, PermissionError } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/logger";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      requireRole(session, "write");
    } catch (e) {
      if (e instanceof PermissionError) {
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 }
        );
      }
      throw e;
    }

    const { id } = await params;

    // Verify the alert belongs to this practice
    const [existing] = await db
      .select()
      .from(taxAlerts)
      .where(
        and(
          eq(taxAlerts.id, id),
          eq(taxAlerts.practiceId, session.practiceId)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    // Toggle dismiss state
    const nowDismissed = !existing.isDismissed;

    const [updated] = await db
      .update(taxAlerts)
      .set({
        isDismissed: nowDismissed,
        dismissedAt: nowDismissed ? new Date() : null,
      })
      .where(eq(taxAlerts.id, id))
      .returning();

    await logAuditEvent({
      practiceId: session.practiceId,
      userId: session.userId,
      action: nowDismissed ? "dismiss_tax_alert" : "restore_tax_alert",
      entityType: "tax_alert",
      entityId: id,
      oldValue: { isDismissed: existing.isDismissed },
      newValue: { isDismissed: nowDismissed },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Dismiss tax alert error:", error);
    return NextResponse.json(
      { error: "Failed to update tax alert" },
      { status: 500 }
    );
  }
}
