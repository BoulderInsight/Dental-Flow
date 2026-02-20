import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { getBalances } from "@/lib/plaid/client";
import { db } from "@/lib/db";
import { plaidConnections, plaidAccounts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit/logger";

export async function POST() {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all active connections for this practice
    const connections = await db
      .select()
      .from(plaidConnections)
      .where(
        and(
          eq(plaidConnections.practiceId, session.practiceId),
          eq(plaidConnections.status, "active")
        )
      );

    let totalUpdated = 0;

    for (const connection of connections) {
      try {
        const accounts = await getBalances(connection.accessToken);

        for (const account of accounts) {
          await db
            .update(plaidAccounts)
            .set({
              currentBalance: String(account.balances.current ?? 0),
              availableBalance: account.balances.available != null
                ? String(account.balances.available)
                : null,
              lastBalanceUpdate: new Date(),
            })
            .where(
              and(
                eq(plaidAccounts.plaidConnectionId, connection.id),
                eq(plaidAccounts.plaidAccountId, account.account_id)
              )
            );
          totalUpdated++;
        }

        await db
          .update(plaidConnections)
          .set({ lastSyncedAt: new Date() })
          .where(eq(plaidConnections.id, connection.id));
      } catch (err) {
        console.error(`Plaid sync error for connection ${connection.id}:`, err);
        // Mark connection as errored but continue with others
        await db
          .update(plaidConnections)
          .set({ status: "error" })
          .where(eq(plaidConnections.id, connection.id));
      }
    }

    await logAuditEvent({
      practiceId: session.practiceId,
      userId: session.userId,
      action: "plaid_sync_completed",
      entityType: "plaid_connection",
      newValue: { connectionsProcessed: connections.length, accountsUpdated: totalUpdated },
    });

    return NextResponse.json({
      synced: connections.length,
      accountsUpdated: totalUpdated,
    });
  } catch (error) {
    console.error("Plaid sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync balances" },
      { status: 500 }
    );
  }
}
