import { db } from "@/lib/db";
import {
  transactions,
  categorizations,
  userRules,
  type UserRule,
} from "@/lib/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { categorizeTransaction } from "./rules";
import { getConfigForPractice } from "@/lib/industries";

interface CategorizationResult {
  categorized: number;
  skipped: number;
  uncategorized: number;
}

/**
 * Run Tier 1 rule engine on all uncategorized transactions for a practice.
 * Loads the practice's industry config and passes it to the categorization rules.
 */
export async function categorizeUncategorized(
  practiceId: string
): Promise<CategorizationResult> {
  // Load the practice's industry config
  const config = await getConfigForPractice(practiceId);

  // Get user rules for this practice
  const rules = await db
    .select()
    .from(userRules)
    .where(eq(userRules.practiceId, practiceId))
    .orderBy(userRules.priority);

  // Get transactions that don't have a categorization yet
  const uncategorizedTxns = await db
    .select({
      id: transactions.id,
      vendorName: transactions.vendorName,
      description: transactions.description,
      amount: transactions.amount,
      accountRef: transactions.accountRef,
    })
    .from(transactions)
    .leftJoin(
      categorizations,
      eq(transactions.id, categorizations.transactionId)
    )
    .where(
      and(
        eq(transactions.practiceId, practiceId),
        isNull(categorizations.id)
      )
    );

  let categorized = 0;
  const skipped = 0;
  let uncategorizedCount = 0;

  for (const txn of uncategorizedTxns) {
    const result = categorizeTransaction(
      {
        vendorName: txn.vendorName,
        description: txn.description,
        amount: txn.amount,
        accountRef: txn.accountRef,
      },
      rules as UserRule[],
      config
    );

    if (result) {
      await db.insert(categorizations).values({
        transactionId: txn.id,
        category: result.category,
        confidence: result.confidence,
        source: "rule",
        ruleId: result.ruleId,
        reasoning: result.reasoning,
      });
      categorized++;
    } else {
      uncategorizedCount++;
    }
  }

  return {
    categorized,
    skipped,
    uncategorized: uncategorizedCount,
  };
}
