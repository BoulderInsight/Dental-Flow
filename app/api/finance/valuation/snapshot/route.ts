import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { requireRole, PermissionError } from "@/lib/auth/permissions";
import { saveValuationSnapshot } from "@/lib/finance/valuation";
import { logAuditEvent } from "@/lib/audit/logger";

export async function POST() {
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

    await saveValuationSnapshot(session.practiceId);

    await logAuditEvent({
      practiceId: session.practiceId,
      userId: session.userId,
      action: "create",
      entityType: "valuation_snapshot",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Valuation snapshot error:", error);
    return NextResponse.json(
      { error: "Failed to save valuation snapshot" },
      { status: 500 }
    );
  }
}
