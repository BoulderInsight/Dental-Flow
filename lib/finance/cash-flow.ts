import { db } from "@/lib/db";
import { transactions, categorizations, practices } from "@/lib/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";

export interface FreeCashFlowReport {
  period: { start: Date; end: Date };
  business: {
    netOperatingIncome: number;
    debtService: number;
    freeCash: number;
  };
  personal: {
    income: number;
    expenses: number;
    freeCash: number;
  };
  combined: {
    freeCash: number;
    excessCash: number;
    reserveThreshold: number;
  };
  monthlyTrend: MonthlyFreeCash[];
  rollingAvg3mo: number;
  rollingAvg12mo: number;
}

export interface MonthlyFreeCash {
  month: string;
  businessFreeCash: number;
  personalFreeCash: number;
  combinedFreeCash: number;
}

const DEBT_SERVICE_PATTERNS = [
  "loan payment",
  "note payable",
  "loan interest",
  "equipment loan",
  "practice loan",
  "mortgage",
  "line of credit",
];

const OWNER_DRAW_PATTERNS = [
  "owner's draw",
  "owner's personal",
  "distributions",
  "owner salary",
  "owner draw",
];

function isDebtService(accountRef: string | null): boolean {
  if (!accountRef) return false;
  const lower = accountRef.toLowerCase();
  return DEBT_SERVICE_PATTERNS.some((p) => lower.includes(p));
}

function isOwnerDraw(accountRef: string | null): boolean {
  if (!accountRef) return false;
  const lower = accountRef.toLowerCase();
  return OWNER_DRAW_PATTERNS.some((p) => lower.includes(p));
}

const latestCatId = sql`(
  SELECT c.id FROM categorizations c
  WHERE c.transaction_id = ${transactions.id}
  ORDER BY c.created_at DESC LIMIT 1
)`;

export async function calculateFreeCashFlow(
  practiceId: string,
  months: number = 12
): Promise<FreeCashFlowReport> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date();

  // Get practice reserve threshold
  const [practice] = await db
    .select({ reserveThreshold: practices.reserveThreshold })
    .from(practices)
    .where(eq(practices.id, practiceId))
    .limit(1);

  const reserveThreshold = practice?.reserveThreshold
    ? parseFloat(practice.reserveThreshold)
    : 10000;

  // Get all transactions with categorizations
  const rows = await db
    .select({
      amount: transactions.amount,
      accountRef: transactions.accountRef,
      category: categorizations.category,
      month: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
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
        gte(transactions.date, startDate)
      )
    );

  // Monthly aggregation
  const monthlyMap = new Map<
    string,
    {
      bizRevenue: number;
      bizExpenses: number;
      debtService: number;
      personalIncome: number;
      personalExpenses: number;
    }
  >();

  // Totals for the period
  let totalBizRevenue = 0;
  let totalBizExpenses = 0;
  let totalDebtService = 0;
  let totalPersonalIncome = 0;
  let totalPersonalExpenses = 0;

  for (const row of rows) {
    const amount = parseFloat(row.amount);
    const month = row.month;

    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, {
        bizRevenue: 0,
        bizExpenses: 0,
        debtService: 0,
        personalIncome: 0,
        personalExpenses: 0,
      });
    }
    const m = monthlyMap.get(month)!;

    if (row.category === "personal") {
      if (amount > 0 || isOwnerDraw(row.accountRef)) {
        // Personal income (owner draws are positive from personal perspective)
        const inc = Math.abs(amount);
        m.personalIncome += inc;
        totalPersonalIncome += inc;
      } else {
        const exp = Math.abs(amount);
        m.personalExpenses += exp;
        totalPersonalExpenses += exp;
      }
    } else {
      // Business (including uncategorized defaulting to business)
      if (amount > 0) {
        m.bizRevenue += amount;
        totalBizRevenue += amount;
      } else {
        const absAmt = Math.abs(amount);
        if (isDebtService(row.accountRef)) {
          m.debtService += absAmt;
          totalDebtService += absAmt;
        } else if (isOwnerDraw(row.accountRef)) {
          // Owner draws are personal income from business
          m.personalIncome += absAmt;
          totalPersonalIncome += absAmt;
        } else {
          m.bizExpenses += absAmt;
          totalBizExpenses += absAmt;
        }
      }
    }
  }

  const noi = totalBizRevenue - totalBizExpenses;
  const bizFreeCash = noi - totalDebtService;
  const personalFreeCash = totalPersonalIncome - totalPersonalExpenses;
  const combinedFreeCash = bizFreeCash + personalFreeCash;

  // Build monthly trend sorted
  const monthlyTrend: MonthlyFreeCash[] = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => {
      const bfc = d.bizRevenue - d.bizExpenses - d.debtService;
      const pfc = d.personalIncome - d.personalExpenses;
      return {
        month,
        businessFreeCash: bfc,
        personalFreeCash: pfc,
        combinedFreeCash: bfc + pfc,
      };
    });

  // Rolling averages
  const last3 = monthlyTrend.slice(-3);
  const rollingAvg3mo =
    last3.length > 0
      ? last3.reduce((s, m) => s + m.combinedFreeCash, 0) / last3.length
      : 0;
  const rollingAvg12mo =
    monthlyTrend.length > 0
      ? monthlyTrend.reduce((s, m) => s + m.combinedFreeCash, 0) /
        monthlyTrend.length
      : 0;

  // Monthly average for excess cash calc
  const monthCount = monthlyTrend.length || 1;
  const avgMonthlyCombined = combinedFreeCash / monthCount;
  const excessCash = avgMonthlyCombined - reserveThreshold;

  return {
    period: { start: startDate, end: endDate },
    business: {
      netOperatingIncome: noi,
      debtService: totalDebtService,
      freeCash: bizFreeCash,
    },
    personal: {
      income: totalPersonalIncome,
      expenses: totalPersonalExpenses,
      freeCash: personalFreeCash,
    },
    combined: {
      freeCash: combinedFreeCash,
      excessCash,
      reserveThreshold,
    },
    monthlyTrend,
    rollingAvg3mo,
    rollingAvg12mo,
  };
}
