import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { plaidConnections, plaidAccounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all connections with their accounts
    const connections = await db
      .select()
      .from(plaidConnections)
      .where(eq(plaidConnections.practiceId, session.practiceId));

    const accounts = await db
      .select()
      .from(plaidAccounts)
      .where(eq(plaidAccounts.practiceId, session.practiceId));

    // Group accounts by connection
    const grouped = connections.map((conn) => ({
      id: conn.id,
      institutionName: conn.institutionName,
      institutionId: conn.institutionId,
      status: conn.status,
      lastSyncedAt: conn.lastSyncedAt,
      createdAt: conn.createdAt,
      accounts: accounts
        .filter((a) => a.plaidConnectionId === conn.id)
        .map((a) => ({
          id: a.id,
          plaidAccountId: a.plaidAccountId,
          name: a.name,
          officialName: a.officialName,
          type: a.type,
          subtype: a.subtype,
          currentBalance: parseFloat(a.currentBalance),
          availableBalance: a.availableBalance ? parseFloat(a.availableBalance) : null,
          currency: a.currency,
          isIncludedInNetWorth: a.isIncludedInNetWorth,
          lastBalanceUpdate: a.lastBalanceUpdate,
        })),
    }));

    return NextResponse.json(grouped);
  } catch (error) {
    console.error("Plaid accounts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}
