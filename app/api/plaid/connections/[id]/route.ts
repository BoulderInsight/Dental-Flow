import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { plaidConnections, plaidAccounts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit/logger";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify practice ownership
    const [connection] = await db
      .select({
        id: plaidConnections.id,
        institutionName: plaidConnections.institutionName,
      })
      .from(plaidConnections)
      .where(
        and(
          eq(plaidConnections.id, id),
          eq(plaidConnections.practiceId, session.practiceId)
        )
      )
      .limit(1);

    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    // Delete accounts first (cascade should handle this, but be explicit)
    await db
      .delete(plaidAccounts)
      .where(eq(plaidAccounts.plaidConnectionId, id));

    // Delete connection
    await db
      .delete(plaidConnections)
      .where(eq(plaidConnections.id, id));

    await logAuditEvent({
      practiceId: session.practiceId,
      userId: session.userId,
      action: "plaid_connection_deleted",
      entityType: "plaid_connection",
      entityId: id,
      oldValue: { institutionName: connection.institutionName },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Plaid connection delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete connection" },
      { status: 500 }
    );
  }
}
