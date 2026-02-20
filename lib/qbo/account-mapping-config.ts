import { db } from "@/lib/db";
import { qboAccountMappings, practices } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getValidTokens } from "./token-manager";
import { makeApiCall } from "./client";
import { isDemoMode } from "./demo-mode";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QBOAccount {
  id: string;
  name: string;
  type: string;
  subType?: string;
  fullyQualifiedName?: string;
}

export interface AccountMappingRow {
  id: string;
  practiceId: string;
  ourCategory: string;
  qboAccountId: string;
  qboAccountName: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// QBO Chart of Accounts
// ---------------------------------------------------------------------------

/**
 * Fetch the chart of accounts from QBO API.
 * Returns expense-type accounts that are relevant for categorization mapping.
 */
export async function getQBOAccounts(
  practiceId: string
): Promise<QBOAccount[]> {
  if (isDemoMode()) {
    // Return demo accounts for testing
    return [
      { id: "1", name: "Business Checking", type: "Bank" },
      { id: "2", name: "Business Savings", type: "Bank" },
      { id: "10", name: "Business Operating Expenses", type: "Expense" },
      { id: "11", name: "Rent & Lease", type: "Expense" },
      { id: "12", name: "Utilities", type: "Expense" },
      { id: "13", name: "Insurance", type: "Expense" },
      { id: "14", name: "Payroll", type: "Expense" },
      { id: "15", name: "Supplies", type: "Expense" },
      { id: "16", name: "Professional Fees", type: "Expense" },
      { id: "17", name: "Marketing & Advertising", type: "Expense" },
      { id: "18", name: "Equipment & Maintenance", type: "Expense" },
      { id: "19", name: "Continuing Education", type: "Expense" },
      { id: "20", name: "Owner Draw", type: "Equity" },
      { id: "21", name: "Personal Expenses", type: "Expense" },
      { id: "30", name: "Uncategorized Expenses", type: "Expense" },
      { id: "40", name: "Revenue - Services", type: "Income" },
      { id: "41", name: "Revenue - Products", type: "Income" },
    ];
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

  const query = encodeURIComponent(
    "SELECT * FROM Account WHERE Active = true MAXRESULTS 500"
  );

  const data = (await makeApiCall(
    tokens.accessToken,
    practice.qboRealmId,
    `query?query=${query}`
  )) as {
    QueryResponse?: {
      Account?: Array<{
        Id: string;
        Name: string;
        AccountType: string;
        AccountSubType?: string;
        FullyQualifiedName?: string;
        Active?: boolean;
      }>;
    };
  };

  const accounts = data?.QueryResponse?.Account || [];

  return accounts.map((acct) => ({
    id: acct.Id,
    name: acct.Name,
    type: acct.AccountType,
    subType: acct.AccountSubType,
    fullyQualifiedName: acct.FullyQualifiedName,
  }));
}

// ---------------------------------------------------------------------------
// Mapping CRUD
// ---------------------------------------------------------------------------

/**
 * Get all account mappings for a practice.
 */
export async function getMappings(
  practiceId: string
): Promise<AccountMappingRow[]> {
  const rows = await db
    .select()
    .from(qboAccountMappings)
    .where(eq(qboAccountMappings.practiceId, practiceId));

  return rows;
}

/**
 * Save (upsert) account mappings.
 * Each mapping maps one of our categories (business/personal/ambiguous)
 * to a specific QBO account.
 */
export async function saveMappings(
  practiceId: string,
  mappings: Array<{
    ourCategory: string;
    qboAccountId: string;
    qboAccountName: string;
  }>
): Promise<void> {
  // Use a transaction to ensure atomicity
  await db.transaction(async (tx) => {
    for (const mapping of mappings) {
      // Upsert: try to update existing, insert if not found
      const existing = await tx
        .select({ id: qboAccountMappings.id })
        .from(qboAccountMappings)
        .where(
          and(
            eq(qboAccountMappings.practiceId, practiceId),
            eq(qboAccountMappings.ourCategory, mapping.ourCategory)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await tx
          .update(qboAccountMappings)
          .set({
            qboAccountId: mapping.qboAccountId,
            qboAccountName: mapping.qboAccountName,
          })
          .where(eq(qboAccountMappings.id, existing[0].id));
      } else {
        await tx.insert(qboAccountMappings).values({
          practiceId,
          ourCategory: mapping.ourCategory,
          qboAccountId: mapping.qboAccountId,
          qboAccountName: mapping.qboAccountName,
        });
      }
    }
  });
}
