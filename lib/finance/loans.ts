import { db } from "@/lib/db";
import { loans, transactions, categorizations } from "@/lib/db/schema";
import { eq, and, gte, lt, sql } from "drizzle-orm";
import { getConfigForPractice } from "@/lib/industries";
import type { Loan, NewLoan } from "@/lib/db/schema";

export interface DetectedLoan {
  name: string;
  estimatedMonthlyPayment: number;
  frequency: "monthly" | "quarterly";
  transactionPattern: string;
  firstSeen: Date;
  lastSeen: Date;
  occurrences: number;
}

// Common loan-related keywords beyond what industry config provides
const DEFAULT_LOAN_PATTERNS = [
  "loan",
  "mortgage",
  "financing",
  "sba",
  "line of credit",
  "loc payment",
  "note payable",
  "equipment loan",
  "practice loan",
  "capital lease",
  "debt service",
  "installment",
];

const latestCatId = sql`(
  SELECT c.id FROM categorizations c
  WHERE c.transaction_id = ${transactions.id}
  ORDER BY c.created_at DESC LIMIT 1
)`;

/**
 * Auto-detect loans from recurring transaction patterns.
 * Scans business transactions for recurring negative amounts matching debt service patterns.
 * Groups by vendor + approximate amount (±5%), requires 3+ occurrences.
 * Returns detected loans not yet in the loans table.
 */
export async function detectLoans(
  practiceId: string
): Promise<DetectedLoan[]> {
  // Load industry config for debt service patterns
  const config = await getConfigForPractice(practiceId);
  const debtPatterns = [
    ...new Set([...config.debtServicePatterns, ...DEFAULT_LOAN_PATTERNS]),
  ];

  // Look at 18 months of transactions for patterns
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 18);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      vendorName: transactions.vendorName,
      description: transactions.description,
      amount: transactions.amount,
      date: transactions.date,
      accountRef: transactions.accountRef,
      category: categorizations.category,
    })
    .from(transactions)
    .leftJoin(
      categorizations,
      and(
        eq(transactions.id, categorizations.transactionId),
        eq(categorizations.id, latestCatId)
      )
    )
    .where(
      and(
        eq(transactions.practiceId, practiceId),
        gte(transactions.date, startDate),
        lt(transactions.amount, sql`0`) // Only negative (outflow) transactions
      )
    );

  // Filter to transactions that match debt service patterns
  const debtTransactions = rows.filter((row) => {
    // Skip personal-only transactions
    if (row.category === "personal") return false;

    const searchFields = [
      row.vendorName || "",
      row.description || "",
      row.accountRef || "",
    ]
      .join(" ")
      .toLowerCase();

    return debtPatterns.some((p) => searchFields.includes(p.toLowerCase()));
  });

  // Group by vendor + approximate amount (±5%)
  interface TxnGroup {
    name: string;
    pattern: string;
    amounts: number[];
    dates: Date[];
  }

  const groups = new Map<string, TxnGroup>();

  for (const txn of debtTransactions) {
    const absAmount = Math.abs(parseFloat(txn.amount));
    const vendorKey = (txn.vendorName || txn.description || "Unknown")
      .trim()
      .toLowerCase();

    // Find an existing group with a similar amount (±5%)
    let matched = false;
    for (const [key, group] of groups) {
      if (!key.startsWith(vendorKey)) continue;
      const avgAmount =
        group.amounts.reduce((s, a) => s + a, 0) / group.amounts.length;
      if (Math.abs(absAmount - avgAmount) / avgAmount <= 0.05) {
        group.amounts.push(absAmount);
        group.dates.push(new Date(txn.date));
        matched = true;
        break;
      }
    }

    if (!matched) {
      const groupKey = `${vendorKey}:${Math.round(absAmount)}`;
      groups.set(groupKey, {
        name: txn.vendorName || txn.description || "Unknown Payment",
        pattern: vendorKey,
        amounts: [absAmount],
        dates: [new Date(txn.date)],
      });
    }
  }

  // Get existing loans to exclude already-tracked patterns
  const existingLoans = await db
    .select({
      name: loans.name,
      matchedTransactionPattern: loans.matchedTransactionPattern,
      monthlyPayment: loans.monthlyPayment,
    })
    .from(loans)
    .where(eq(loans.practiceId, practiceId));

  const existingPatterns = new Set(
    existingLoans
      .map((l) => l.matchedTransactionPattern?.toLowerCase())
      .filter(Boolean)
  );
  const existingNames = new Set(
    existingLoans.map((l) => l.name.toLowerCase())
  );

  // Build detected loans from groups with 3+ occurrences
  const detected: DetectedLoan[] = [];

  for (const group of groups.values()) {
    if (group.amounts.length < 3) continue;

    // Skip if already tracked
    if (
      existingPatterns.has(group.pattern) ||
      existingNames.has(group.name.toLowerCase())
    ) {
      continue;
    }

    const sortedDates = group.dates.sort((a, b) => a.getTime() - b.getTime());
    const avgAmount =
      group.amounts.reduce((s, a) => s + a, 0) / group.amounts.length;

    // Determine frequency: check average days between payments
    let totalGap = 0;
    for (let i = 1; i < sortedDates.length; i++) {
      totalGap +=
        (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) /
        (1000 * 60 * 60 * 24);
    }
    const avgGapDays =
      sortedDates.length > 1 ? totalGap / (sortedDates.length - 1) : 30;
    const frequency: "monthly" | "quarterly" =
      avgGapDays > 60 ? "quarterly" : "monthly";

    detected.push({
      name: group.name,
      estimatedMonthlyPayment:
        frequency === "quarterly"
          ? Math.round((avgAmount / 3) * 100) / 100
          : Math.round(avgAmount * 100) / 100,
      frequency,
      transactionPattern: group.pattern,
      firstSeen: sortedDates[0],
      lastSeen: sortedDates[sortedDates.length - 1],
      occurrences: group.amounts.length,
    });
  }

  // Sort by estimated monthly payment descending (largest first)
  return detected.sort(
    (a, b) => b.estimatedMonthlyPayment - a.estimatedMonthlyPayment
  );
}

/**
 * Get all loans for a practice (auto-detected + manual).
 */
export async function getLoans(practiceId: string): Promise<Loan[]> {
  return db
    .select()
    .from(loans)
    .where(eq(loans.practiceId, practiceId))
    .orderBy(loans.name);
}

/**
 * Get a single loan by ID, verifying practice ownership.
 */
export async function getLoanById(
  loanId: string,
  practiceId: string
): Promise<Loan | null> {
  const [loan] = await db
    .select()
    .from(loans)
    .where(and(eq(loans.id, loanId), eq(loans.practiceId, practiceId)))
    .limit(1);
  return loan || null;
}

/**
 * Create a new loan entry.
 */
export async function createLoan(data: NewLoan): Promise<Loan> {
  const [loan] = await db.insert(loans).values(data).returning();
  return loan;
}

/**
 * Update an existing loan.
 */
export async function updateLoan(
  loanId: string,
  practiceId: string,
  data: Partial<NewLoan>
): Promise<Loan | null> {
  const [updated] = await db
    .update(loans)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(loans.id, loanId), eq(loans.practiceId, practiceId)))
    .returning();
  return updated || null;
}

/**
 * Delete a loan.
 */
export async function deleteLoan(
  loanId: string,
  practiceId: string
): Promise<boolean> {
  const result = await db
    .delete(loans)
    .where(and(eq(loans.id, loanId), eq(loans.practiceId, practiceId)))
    .returning({ id: loans.id });
  return result.length > 0;
}

/**
 * Calculate total annual debt service from all active loans.
 */
export async function getAnnualDebtService(
  practiceId: string
): Promise<number> {
  const allLoans = await getLoans(practiceId);

  let annual = 0;
  for (const loan of allLoans) {
    const monthly = loan.monthlyPayment
      ? parseFloat(loan.monthlyPayment)
      : 0;
    annual += monthly * 12;
  }

  return Math.round(annual * 100) / 100;
}
