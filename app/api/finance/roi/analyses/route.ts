import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { requireRole, PermissionError } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/logger";
import { db } from "@/lib/db";
import { roiAnalyses } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const analyses = await db
      .select()
      .from(roiAnalyses)
      .where(eq(roiAnalyses.practiceId, session.practiceId))
      .orderBy(desc(roiAnalyses.updatedAt));

    return NextResponse.json({ analyses });
  } catch (error) {
    console.error("ROI analyses list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch ROI analyses" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { name, dealType, inputs, results } = body;

    if (!name || !dealType || !inputs || !results) {
      return NextResponse.json(
        { error: "name, dealType, inputs, and results are required" },
        { status: 400 }
      );
    }

    const [analysis] = await db
      .insert(roiAnalyses)
      .values({
        practiceId: session.practiceId,
        name,
        dealType,
        inputs,
        results,
      })
      .returning();

    await logAuditEvent({
      practiceId: session.practiceId,
      userId: session.userId,
      action: "roi_analysis_saved",
      entityType: "roi_analysis",
      entityId: analysis.id,
      newValue: { name, dealType },
    });

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("ROI analysis save error:", error);
    return NextResponse.json(
      { error: "Failed to save ROI analysis" },
      { status: 500 }
    );
  }
}
