import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { requireRole, PermissionError } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/logger";
import { getLoanById, updateLoan, deleteLoan } from "@/lib/finance/loans";

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
    const existing = await getLoanById(id, session.practiceId);
    if (!existing) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    // Only include fields that are explicitly provided
    if (body.name !== undefined) updateData.name = body.name;
    if (body.lender !== undefined) updateData.lender = body.lender;
    if (body.originalAmount !== undefined)
      updateData.originalAmount = body.originalAmount?.toString() || null;
    if (body.currentBalance !== undefined)
      updateData.currentBalance = body.currentBalance?.toString() || null;
    if (body.interestRate !== undefined)
      updateData.interestRate = body.interestRate?.toString() || null;
    if (body.monthlyPayment !== undefined)
      updateData.monthlyPayment = body.monthlyPayment?.toString() || null;
    if (body.remainingMonths !== undefined)
      updateData.remainingMonths = body.remainingMonths;
    if (body.loanType !== undefined) updateData.loanType = body.loanType;
    if (body.startDate !== undefined) updateData.startDate = body.startDate;
    if (body.maturityDate !== undefined)
      updateData.maturityDate = body.maturityDate;

    const updated = await updateLoan(id, session.practiceId, updateData);

    await logAuditEvent({
      practiceId: session.practiceId,
      userId: session.userId,
      action: "update",
      entityType: "loan",
      entityId: id,
      oldValue: {
        name: existing.name,
        currentBalance: existing.currentBalance,
        interestRate: existing.interestRate,
      },
      newValue: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Loan PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update loan" },
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
    const existing = await getLoanById(id, session.practiceId);
    if (!existing) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    const deleted = await deleteLoan(id, session.practiceId);
    if (!deleted) {
      return NextResponse.json(
        { error: "Failed to delete loan" },
        { status: 500 }
      );
    }

    await logAuditEvent({
      practiceId: session.practiceId,
      userId: session.userId,
      action: "delete",
      entityType: "loan",
      entityId: id,
      oldValue: { name: existing.name, loanType: existing.loanType },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Loan DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete loan" },
      { status: 500 }
    );
  }
}
