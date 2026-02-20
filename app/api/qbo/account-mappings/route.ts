import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { requireRole, PermissionError } from "@/lib/auth/permissions";
import { getMappings, saveMappings } from "@/lib/qbo/account-mapping-config";
import { logAuditEvent } from "@/lib/audit/logger";

export async function GET() {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const mappings = await getMappings(session.practiceId);
    return NextResponse.json({ mappings });
  } catch (error) {
    console.error("Account mappings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch account mappings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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
    const { mappings } = body;

    if (!mappings || !Array.isArray(mappings)) {
      return NextResponse.json(
        { error: "mappings[] required" },
        { status: 400 }
      );
    }

    // Validate each mapping has required fields
    for (const m of mappings) {
      if (!m.ourCategory || !m.qboAccountId || !m.qboAccountName) {
        return NextResponse.json(
          {
            error:
              "Each mapping requires ourCategory, qboAccountId, qboAccountName",
          },
          { status: 400 }
        );
      }
    }

    await saveMappings(session.practiceId, mappings);

    await logAuditEvent({
      practiceId: session.practiceId,
      userId: session.userId,
      action: "account_mappings_updated",
      entityType: "qbo_account_mappings",
      newValue: { mappings },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save mappings error:", error);
    return NextResponse.json(
      { error: "Failed to save account mappings" },
      { status: 500 }
    );
  }
}
