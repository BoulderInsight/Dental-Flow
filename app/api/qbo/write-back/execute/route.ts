import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { requireRole, PermissionError } from "@/lib/auth/permissions";
import { executeWriteBack } from "@/lib/qbo/write-back";

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Owner-only for write-back execution
    try {
      requireRole(session, "admin");
    } catch (e) {
      if (e instanceof PermissionError) {
        return NextResponse.json(
          { error: "Only practice owners can execute QBO write-backs" },
          { status: 403 }
        );
      }
      throw e;
    }

    const body = await request.json();
    const { transactionIds } = body;

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json(
        { error: "transactionIds[] required and must not be empty" },
        { status: 400 }
      );
    }

    // Safety limit
    if (transactionIds.length > 500) {
      return NextResponse.json(
        { error: "Maximum 500 transactions per write-back batch" },
        { status: 400 }
      );
    }

    const result = await executeWriteBack(
      session.practiceId,
      transactionIds,
      session.userId
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Write-back execute error:", error);
    return NextResponse.json(
      { error: "Failed to execute write-back" },
      { status: 500 }
    );
  }
}
