import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { requireRole, PermissionError } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/logger";
import { getLoans, createLoan, detectLoans } from "@/lib/finance/loans";

export async function GET() {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allLoans = await getLoans(session.practiceId);
    const detected = await detectLoans(session.practiceId);

    return NextResponse.json({ loans: allLoans, detected });
  } catch (error) {
    console.error("Loans GET error:", error);
    return NextResponse.json(
      { error: "Failed to load loans" },
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
    const {
      name,
      lender,
      originalAmount,
      currentBalance,
      interestRate,
      monthlyPayment,
      remainingMonths,
      loanType,
      startDate,
      maturityDate,
      isAutoDetected,
      matchedTransactionPattern,
    } = body;

    if (!name || !loanType) {
      return NextResponse.json(
        { error: "name and loanType are required" },
        { status: 400 }
      );
    }

    const loan = await createLoan({
      practiceId: session.practiceId,
      name,
      lender: lender || null,
      originalAmount: originalAmount?.toString() || null,
      currentBalance: currentBalance?.toString() || null,
      interestRate: interestRate?.toString() || null,
      monthlyPayment: monthlyPayment?.toString() || null,
      remainingMonths: remainingMonths || null,
      loanType,
      startDate: startDate || null,
      maturityDate: maturityDate || null,
      isAutoDetected: isAutoDetected || false,
      matchedTransactionPattern: matchedTransactionPattern || null,
    });

    await logAuditEvent({
      practiceId: session.practiceId,
      userId: session.userId,
      action: "create",
      entityType: "loan",
      entityId: loan.id,
      newValue: { name, loanType, currentBalance, interestRate },
    });

    return NextResponse.json(loan, { status: 201 });
  } catch (error) {
    console.error("Loans POST error:", error);
    return NextResponse.json(
      { error: "Failed to create loan" },
      { status: 500 }
    );
  }
}
