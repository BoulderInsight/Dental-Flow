import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { requireRole, PermissionError } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/logger";
import { db } from "@/lib/db";
import { roiAnalyses } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
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

    // Verify the analysis belongs to this practice
    const [existing] = await db
      .select({ id: roiAnalyses.id, name: roiAnalyses.name })
      .from(roiAnalyses)
      .where(
        and(
          eq(roiAnalyses.id, id),
          eq(roiAnalyses.practiceId, session.practiceId)
        )
      );

    if (!existing) {
      return NextResponse.json(
        { error: "Analysis not found" },
        { status: 404 }
      );
    }

    await db
      .delete(roiAnalyses)
      .where(
        and(
          eq(roiAnalyses.id, id),
          eq(roiAnalyses.practiceId, session.practiceId)
        )
      );

    await logAuditEvent({
      practiceId: session.practiceId,
      userId: session.userId,
      action: "roi_analysis_deleted",
      entityType: "roi_analysis",
      entityId: id,
      oldValue: { name: existing.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("ROI analysis delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete ROI analysis" },
      { status: 500 }
    );
  }
}
