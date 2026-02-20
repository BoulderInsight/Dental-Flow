import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/logger";
import { db } from "@/lib/db";
import { retirementMilestones } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    requireRole(session, "write");

    const { id } = await params;
    const body = await request.json();
    const {
      title,
      targetDate,
      estimatedCost,
      estimatedMonthlyIncome,
      category,
      status,
      notes,
    } = body;

    // Verify ownership
    const [existing] = await db
      .select()
      .from(retirementMilestones)
      .where(
        and(
          eq(retirementMilestones.id, id),
          eq(retirementMilestones.practiceId, session.practiceId)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Milestone not found" },
        { status: 404 }
      );
    }

    const updateValues: Record<string, unknown> = {};
    if (title !== undefined) updateValues.title = title;
    if (targetDate !== undefined)
      updateValues.targetDate = targetDate || null;
    if (estimatedCost !== undefined)
      updateValues.estimatedCost = estimatedCost ? String(estimatedCost) : null;
    if (estimatedMonthlyIncome !== undefined)
      updateValues.estimatedMonthlyIncome = estimatedMonthlyIncome
        ? String(estimatedMonthlyIncome)
        : null;
    if (category !== undefined) updateValues.category = category;
    if (status !== undefined) updateValues.status = status;
    if (notes !== undefined) updateValues.notes = notes || null;

    const [updated] = await db
      .update(retirementMilestones)
      .set(updateValues)
      .where(eq(retirementMilestones.id, id))
      .returning();

    await logAuditEvent({
      practiceId: session.practiceId,
      userId: session.userId,
      action: "update",
      entityType: "retirement_milestone",
      entityId: id,
      oldValue: {
        title: existing.title,
        status: existing.status,
      },
      newValue: updateValues,
    });

    return NextResponse.json({
      milestone: {
        id: updated.id,
        title: updated.title,
        targetDate: updated.targetDate,
        estimatedCost: updated.estimatedCost
          ? parseFloat(updated.estimatedCost)
          : null,
        estimatedMonthlyIncome: updated.estimatedMonthlyIncome
          ? parseFloat(updated.estimatedMonthlyIncome)
          : null,
        category: updated.category,
        status: updated.status,
        notes: updated.notes,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "PermissionError") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Update milestone error:", error);
    return NextResponse.json(
      { error: "Failed to update milestone" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    requireRole(session, "write");

    const { id } = await params;

    // Verify ownership
    const [existing] = await db
      .select({ id: retirementMilestones.id })
      .from(retirementMilestones)
      .where(
        and(
          eq(retirementMilestones.id, id),
          eq(retirementMilestones.practiceId, session.practiceId)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Milestone not found" },
        { status: 404 }
      );
    }

    await db
      .delete(retirementMilestones)
      .where(eq(retirementMilestones.id, id));

    await logAuditEvent({
      practiceId: session.practiceId,
      userId: session.userId,
      action: "delete",
      entityType: "retirement_milestone",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "PermissionError") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Delete milestone error:", error);
    return NextResponse.json(
      { error: "Failed to delete milestone" },
      { status: 500 }
    );
  }
}
