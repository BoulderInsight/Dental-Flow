import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/logger";
import { db } from "@/lib/db";
import { retirementMilestones } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const milestones = await db
      .select()
      .from(retirementMilestones)
      .where(eq(retirementMilestones.practiceId, session.practiceId))
      .orderBy(asc(retirementMilestones.targetDate));

    return NextResponse.json({
      milestones: milestones.map((m) => ({
        id: m.id,
        title: m.title,
        targetDate: m.targetDate,
        estimatedCost: m.estimatedCost ? parseFloat(m.estimatedCost) : null,
        estimatedMonthlyIncome: m.estimatedMonthlyIncome
          ? parseFloat(m.estimatedMonthlyIncome)
          : null,
        category: m.category,
        status: m.status,
        notes: m.notes,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("List milestones error:", error);
    return NextResponse.json(
      { error: "Failed to load milestones" },
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

    requireRole(session, "write");

    const body = await request.json();
    const {
      title,
      targetDate,
      estimatedCost,
      estimatedMonthlyIncome,
      category,
      notes,
    } = body;

    if (!title || !category) {
      return NextResponse.json(
        { error: "title and category are required" },
        { status: 400 }
      );
    }

    const [milestone] = await db
      .insert(retirementMilestones)
      .values({
        practiceId: session.practiceId,
        title,
        targetDate: targetDate || null,
        estimatedCost: estimatedCost ? String(estimatedCost) : null,
        estimatedMonthlyIncome: estimatedMonthlyIncome
          ? String(estimatedMonthlyIncome)
          : null,
        category,
        notes: notes || null,
      })
      .returning();

    await logAuditEvent({
      practiceId: session.practiceId,
      userId: session.userId,
      action: "create",
      entityType: "retirement_milestone",
      entityId: milestone.id,
      newValue: { title, category, targetDate },
    });

    return NextResponse.json({
      milestone: {
        id: milestone.id,
        title: milestone.title,
        targetDate: milestone.targetDate,
        estimatedCost: milestone.estimatedCost
          ? parseFloat(milestone.estimatedCost)
          : null,
        estimatedMonthlyIncome: milestone.estimatedMonthlyIncome
          ? parseFloat(milestone.estimatedMonthlyIncome)
          : null,
        category: milestone.category,
        status: milestone.status,
        notes: milestone.notes,
        createdAt: milestone.createdAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "PermissionError") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Create milestone error:", error);
    return NextResponse.json(
      { error: "Failed to create milestone" },
      { status: 500 }
    );
  }
}
