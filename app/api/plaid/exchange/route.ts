import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { exchangePublicToken, getAccounts } from "@/lib/plaid/client";
import { db } from "@/lib/db";
import { plaidConnections, plaidAccounts } from "@/lib/db/schema";
import { logAuditEvent } from "@/lib/audit/logger";
import { z } from "zod";

const exchangeSchema = z.object({
  publicToken: z.string(),
  institutionName: z.string(),
  institutionId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = exchangeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { publicToken, institutionName, institutionId } = parsed.data;

    // Exchange public token for encrypted access token
    const { accessToken, itemId } = await exchangePublicToken(publicToken);

    // Store connection
    const [connection] = await db
      .insert(plaidConnections)
      .values({
        practiceId: session.practiceId,
        plaidItemId: itemId,
        accessToken,
        institutionName,
        institutionId,
        status: "active",
        lastSyncedAt: new Date(),
      })
      .returning({ id: plaidConnections.id });

    // Fetch initial accounts
    const accounts = await getAccounts(accessToken);

    for (const account of accounts) {
      await db.insert(plaidAccounts).values({
        practiceId: session.practiceId,
        plaidConnectionId: connection.id,
        plaidAccountId: account.account_id,
        name: account.name,
        officialName: account.official_name || null,
        type: account.type,
        subtype: account.subtype || null,
        currentBalance: String(account.balances.current ?? 0),
        availableBalance: account.balances.available != null
          ? String(account.balances.available)
          : null,
        currency: account.balances.iso_currency_code || "USD",
        isIncludedInNetWorth: true,
        lastBalanceUpdate: new Date(),
      });
    }

    await logAuditEvent({
      practiceId: session.practiceId,
      userId: session.userId,
      action: "plaid_connection_created",
      entityType: "plaid_connection",
      entityId: connection.id,
      newValue: { institutionName, institutionId, accountCount: accounts.length },
    });

    return NextResponse.json({
      connectionId: connection.id,
      accountCount: accounts.length,
    });
  } catch (error) {
    console.error("Plaid exchange error:", error);
    return NextResponse.json(
      { error: "Failed to exchange token" },
      { status: 500 }
    );
  }
}
