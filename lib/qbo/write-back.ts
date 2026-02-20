import { db } from "@/lib/db";
import {
  transactions,
  categorizations,
  qboAccountMappings,
  practices,
  auditLog,
} from "@/lib/db/schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { getValidTokens } from "./token-manager";
import { makeApiCall } from "./client";
import { isDemoMode } from "./demo-mode";
import { logAuditEvent } from "@/lib/audit/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WriteBackItem {
  transactionId: string;
  qboTxnId: string;
  qboTxnType: string;
  currentAccountRef: string;
  targetAccountRef: string;
  targetAccountId: string;
  category: string;
  confidence: number;
  amount: number;
  vendorName: string | null;
  date: Date;
}

export interface WriteBackPreview {
  items: WriteBackItem[];
  totalTransactions: number;
  accountMappings: Record<string, string>;
}

export interface WriteBackResult {
  succeeded: number;
  failed: number;
  errors: Array<{ transactionId: string; error: string }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Make a POST API call to QBO (for updates).
 * The Intuit API uses POST for create/update operations with JSON body.
 */
async function makeApiPost(
  accessToken: string,
  realmId: string,
  endpoint: string,
  body: unknown
): Promise<unknown> {
  const baseUrl =
    process.env.INTUIT_ENVIRONMENT === "production"
      ? "https://quickbooks.api.intuit.com"
      : "https://sandbox-quickbooks.api.intuit.com";

  const url = `${baseUrl}/v3/company/${realmId}/${endpoint}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`QBO API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

/**
 * Build a preview of transactions eligible for QBO write-back.
 *
 * Eligible = transaction has a categorization AND a QBO account mapping
 * exists for that category, AND the transaction's current accountRef
 * differs from the mapped target.
 */
export async function previewWriteBack(
  practiceId: string,
  options?: {
    sinceDate?: Date;
    onlyHighConfidence?: boolean;
    categories?: string[];
  }
): Promise<WriteBackPreview> {
  // 1. Get all account mappings for this practice
  const mappings = await db
    .select()
    .from(qboAccountMappings)
    .where(eq(qboAccountMappings.practiceId, practiceId));

  if (mappings.length === 0) {
    return { items: [], totalTransactions: 0, accountMappings: {} };
  }

  const mappingMap: Record<string, { qboAccountId: string; qboAccountName: string }> = {};
  const accountMappingsDisplay: Record<string, string> = {};
  for (const m of mappings) {
    mappingMap[m.ourCategory] = {
      qboAccountId: m.qboAccountId,
      qboAccountName: m.qboAccountName,
    };
    accountMappingsDisplay[m.ourCategory] = m.qboAccountName;
  }

  // 2. Fetch transactions with their latest categorization
  // Using a subquery for the latest categorization per transaction
  const conditions = [eq(transactions.practiceId, practiceId)];

  if (options?.sinceDate) {
    conditions.push(gte(transactions.date, options.sinceDate));
  }

  const txns = await db
    .select({
      id: transactions.id,
      qboTxnId: transactions.qboTxnId,
      accountRef: transactions.accountRef,
      amount: transactions.amount,
      vendorName: transactions.vendorName,
      date: transactions.date,
      rawJson: transactions.rawJson,
    })
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.date));

  // 3. For each transaction, get latest categorization
  const items: WriteBackItem[] = [];

  for (const txn of txns) {
    const [latestCat] = await db
      .select({
        category: categorizations.category,
        confidence: categorizations.confidence,
      })
      .from(categorizations)
      .where(eq(categorizations.transactionId, txn.id))
      .orderBy(desc(categorizations.createdAt))
      .limit(1);

    if (!latestCat) continue;

    // Apply filters
    if (options?.onlyHighConfidence && latestCat.confidence < 90) continue;
    if (
      options?.categories &&
      options.categories.length > 0 &&
      !options.categories.includes(latestCat.category)
    ) {
      continue;
    }

    // Check if mapping exists for this category
    const mapping = mappingMap[latestCat.category];
    if (!mapping) continue;

    // Skip if already mapped to the target account
    if (txn.accountRef === mapping.qboAccountName) continue;

    // Determine QBO transaction type from rawJson
    const raw = txn.rawJson as Record<string, unknown> | null;
    let qboTxnType = "Purchase";
    if (raw) {
      // QBO objects typically have a type indicator or we can infer from presence of fields
      if (raw.PaymentType !== undefined || raw.Credit !== undefined) {
        qboTxnType = "Purchase";
      } else if (raw.DepositToAccountRef !== undefined) {
        qboTxnType = "Deposit";
      } else if (raw.FromAccountRef !== undefined && raw.ToAccountRef !== undefined) {
        qboTxnType = "Transfer";
      }
    }

    items.push({
      transactionId: txn.id,
      qboTxnId: txn.qboTxnId,
      qboTxnType,
      currentAccountRef: txn.accountRef || "Uncategorized",
      targetAccountRef: mapping.qboAccountName,
      targetAccountId: mapping.qboAccountId,
      category: latestCat.category,
      confidence: latestCat.confidence,
      amount: parseFloat(txn.amount),
      vendorName: txn.vendorName,
      date: txn.date,
    });
  }

  return {
    items,
    totalTransactions: items.length,
    accountMappings: accountMappingsDisplay,
  };
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

/**
 * Execute write-back for selected transactions.
 *
 * For each transaction:
 * 1. Read current QBO transaction to get SyncToken
 * 2. Update the AccountRef to the mapped target
 * 3. POST the update to QBO
 * 4. Update local accountRef
 * 5. Log audit event
 *
 * Processes sequentially with 200ms delay for QBO rate limiting (~500/min).
 */
export async function executeWriteBack(
  practiceId: string,
  transactionIds: string[],
  userId: string
): Promise<WriteBackResult> {
  if (isDemoMode()) {
    // In demo mode, simulate success for all transactions
    return {
      succeeded: transactionIds.length,
      failed: 0,
      errors: [],
    };
  }

  const tokens = await getValidTokens(practiceId);
  if (!tokens) {
    throw new Error("No valid QBO tokens for practice");
  }

  const [practice] = await db
    .select({ qboRealmId: practices.qboRealmId })
    .from(practices)
    .where(eq(practices.id, practiceId));

  if (!practice?.qboRealmId) {
    throw new Error("Practice has no QBO realm ID");
  }

  // Get mappings
  const mappings = await db
    .select()
    .from(qboAccountMappings)
    .where(eq(qboAccountMappings.practiceId, practiceId));

  const mappingMap: Record<string, { qboAccountId: string; qboAccountName: string }> = {};
  for (const m of mappings) {
    mappingMap[m.ourCategory] = {
      qboAccountId: m.qboAccountId,
      qboAccountName: m.qboAccountName,
    };
  }

  let succeeded = 0;
  let failed = 0;
  const errors: Array<{ transactionId: string; error: string }> = [];

  for (const txnId of transactionIds) {
    try {
      // 1. Get local transaction + latest categorization
      const [txn] = await db
        .select({
          id: transactions.id,
          qboTxnId: transactions.qboTxnId,
          accountRef: transactions.accountRef,
          rawJson: transactions.rawJson,
        })
        .from(transactions)
        .where(
          and(eq(transactions.id, txnId), eq(transactions.practiceId, practiceId))
        );

      if (!txn) {
        errors.push({ transactionId: txnId, error: "Transaction not found" });
        failed++;
        continue;
      }

      const [latestCat] = await db
        .select({ category: categorizations.category })
        .from(categorizations)
        .where(eq(categorizations.transactionId, txnId))
        .orderBy(desc(categorizations.createdAt))
        .limit(1);

      if (!latestCat) {
        errors.push({ transactionId: txnId, error: "No categorization found" });
        failed++;
        continue;
      }

      const mapping = mappingMap[latestCat.category];
      if (!mapping) {
        errors.push({
          transactionId: txnId,
          error: `No QBO mapping for category: ${latestCat.category}`,
        });
        failed++;
        continue;
      }

      // 2. Determine transaction type from raw JSON
      const raw = txn.rawJson as Record<string, unknown> | null;
      let qboTxnType = "Purchase";
      if (raw) {
        if (raw.DepositToAccountRef !== undefined) {
          qboTxnType = "Deposit";
        } else if (raw.FromAccountRef !== undefined && raw.ToAccountRef !== undefined) {
          qboTxnType = "Transfer";
        }
      }

      // 3. Read current QBO transaction to get SyncToken
      const qboData = (await makeApiCall(
        tokens.accessToken,
        practice.qboRealmId,
        `${qboTxnType.toLowerCase()}/${txn.qboTxnId}`
      )) as Record<string, Record<string, unknown>>;

      const qboEntity = qboData[qboTxnType];
      if (!qboEntity) {
        errors.push({
          transactionId: txnId,
          error: `Could not read QBO ${qboTxnType} ${txn.qboTxnId}`,
        });
        failed++;
        continue;
      }

      const syncToken = qboEntity.SyncToken as string;
      const oldAccountRef = txn.accountRef;

      // 4. Update the AccountRef on the QBO entity
      const updatedEntity = {
        ...qboEntity,
        AccountRef: {
          value: mapping.qboAccountId,
          name: mapping.qboAccountName,
        },
        SyncToken: syncToken,
        sparse: true, // sparse update — only send changed fields
      };

      // 5. POST update to QBO
      await makeApiPost(
        tokens.accessToken,
        practice.qboRealmId,
        `${qboTxnType.toLowerCase()}?operation=update`,
        updatedEntity
      );

      // 6. Update local transaction
      await db
        .update(transactions)
        .set({ accountRef: mapping.qboAccountName })
        .where(eq(transactions.id, txnId));

      // 7. Audit log
      await logAuditEvent({
        practiceId,
        userId,
        action: "qbo_write_back",
        entityType: "transaction",
        entityId: txnId,
        oldValue: { accountRef: oldAccountRef },
        newValue: {
          accountRef: mapping.qboAccountName,
          qboAccountId: mapping.qboAccountId,
          qboTxnId: txn.qboTxnId,
          category: latestCat.category,
        },
      });

      succeeded++;

      // 8. Rate limit delay (200ms = ~300/min, well within QBO 500/min limit)
      await sleep(200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push({ transactionId: txnId, error: message });
      failed++;
    }
  }

  // Log summary audit event
  await logAuditEvent({
    practiceId,
    userId,
    action: "qbo_write_back_batch",
    entityType: "write_back",
    newValue: {
      succeeded,
      failed,
      totalRequested: transactionIds.length,
      errorCount: errors.length,
    },
  });

  return { succeeded, failed, errors };
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

/**
 * Fetch write-back history from audit_log.
 */
export async function getWriteBackHistory(
  practiceId: string,
  limit = 50
) {
  const entries = await db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.practiceId, practiceId),
        eq(auditLog.action, "qbo_write_back_batch")
      )
    )
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);

  return entries.map((entry) => ({
    id: entry.id,
    userId: entry.userId,
    createdAt: entry.createdAt,
    details: entry.newValue as {
      succeeded: number;
      failed: number;
      totalRequested: number;
      errorCount: number;
    },
  }));
}
