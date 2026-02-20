import { db } from "@/lib/db";
import { transactions, practices as practicesTable } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getValidTokens } from "./token-manager";
import { makeApiCall } from "./client";
import { isDemoMode } from "./demo-mode";

interface QboTransaction {
  Id: string;
  TxnDate: string;
  TotalAmt: number;
  EntityRef?: { name: string };
  PrivateNote?: string;
  AccountRef?: { name: string };
  Line?: Array<{ Description?: string; Amount?: number }>;
}

interface SyncResult {
  synced: number;
  skipped: number;
  errors: number;
}

/**
 * Fetch transactions from QBO for the last N months and upsert into our database.
 * Deduplicates by qbo_txn_id per practice.
 */
export async function syncTransactions(
  practiceId: string,
  monthsBack = 12
): Promise<SyncResult> {
  if (isDemoMode()) {
    // In demo mode, seed data is already in the DB
    return { synced: 0, skipped: 0, errors: 0 };
  }

  const tokens = await getValidTokens(practiceId);
  if (!tokens) {
    throw new Error("No valid QBO tokens for practice");
  }

  const [practice] = await db
    .select()
    .from(practicesTable)
    .where(eq(practicesTable.id, practiceId));
  if (!practice?.qboRealmId) {
    throw new Error("Practice has no QBO realm ID");
  }

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - monthsBack);
  const startStr = startDate.toISOString().split("T")[0];

  let synced = 0;
  let skipped = 0;
  let errors = 0;

  // Fetch from Purchase, Deposit, Transfer endpoints
  const endpoints = ["Purchase", "Deposit", "Transfer"];

  for (const endpoint of endpoints) {
    try {
      const query = encodeURIComponent(
        `SELECT * FROM ${endpoint} WHERE TxnDate >= '${startStr}' MAXRESULTS 1000`
      );
      const data = (await makeApiCall(
        tokens.accessToken,
        practice.qboRealmId,
        `query?query=${query}`
      )) as {
        QueryResponse?: Record<string, QboTransaction[]>;
      };

      const items =
        data?.QueryResponse?.[endpoint] || [];

      for (const item of items) {
        try {
          const existing = await db
            .select({ id: transactions.id })
            .from(transactions)
            .where(
              and(
                eq(transactions.practiceId, practiceId),
                eq(transactions.qboTxnId, item.Id)
              )
            );

          const txnData = {
            practiceId,
            qboTxnId: item.Id,
            date: new Date(item.TxnDate),
            amount: String(item.TotalAmt),
            vendorName: item.EntityRef?.name || null,
            description:
              item.PrivateNote || item.Line?.[0]?.Description || null,
            accountRef: item.AccountRef?.name || null,
            rawJson: item,
            syncedAt: new Date(),
          };

          if (existing.length > 0) {
            await db
              .update(transactions)
              .set(txnData)
              .where(eq(transactions.id, existing[0].id));
            skipped++;
          } else {
            await db.insert(transactions).values(txnData);
            synced++;
          }
        } catch {
          errors++;
        }
      }
    } catch {
      errors++;
    }
  }

  return { synced, skipped, errors };
}
