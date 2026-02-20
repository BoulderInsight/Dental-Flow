import { db } from "@/lib/db";
import { financialSnapshots } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { calculateProfitability } from "./profitability";
import { calculateFreeCashFlow } from "./cash-flow";

export interface FinancialSnapshotData {
  revenue: number;
  operatingExpenses: number;
  overheadRatio: number;
  netOperatingIncome: number;
  ownerCompensation: number;
  trueNetProfit: number;
  businessFreeCash: number;
  personalFreeCash: number;
  combinedFreeCash: number;
  excessCash: number;
  computedAt: Date;
  isStale: boolean;
}

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function getLatestSnapshot(
  practiceId: string
): Promise<FinancialSnapshotData | null> {
  const [snapshot] = await db
    .select()
    .from(financialSnapshots)
    .where(
      and(
        eq(financialSnapshots.practiceId, practiceId),
        eq(financialSnapshots.periodType, "monthly")
      )
    )
    .orderBy(desc(financialSnapshots.computedAt))
    .limit(1);

  if (!snapshot) return null;

  const isStale =
    Date.now() - snapshot.computedAt.getTime() > STALE_THRESHOLD_MS;

  return {
    revenue: parseFloat(snapshot.revenue || "0"),
    operatingExpenses: parseFloat(snapshot.operatingExpenses || "0"),
    overheadRatio: parseFloat(snapshot.overheadRatio || "0"),
    netOperatingIncome: parseFloat(snapshot.netOperatingIncome || "0"),
    ownerCompensation: parseFloat(snapshot.ownerCompensation || "0"),
    trueNetProfit: parseFloat(snapshot.trueNetProfit || "0"),
    businessFreeCash: parseFloat(snapshot.businessFreeCash || "0"),
    personalFreeCash: parseFloat(snapshot.personalFreeCash || "0"),
    combinedFreeCash: parseFloat(snapshot.combinedFreeCash || "0"),
    excessCash: parseFloat(snapshot.excessCash || "0"),
    computedAt: snapshot.computedAt,
    isStale,
  };
}

export async function refreshSnapshot(
  practiceId: string
): Promise<FinancialSnapshotData> {
  // Current month boundaries
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const profitability = await calculateProfitability(
    practiceId,
    periodStart,
    periodEnd
  );
  const cashFlow = await calculateFreeCashFlow(practiceId, 1);

  const data = {
    practiceId,
    periodStart,
    periodEnd,
    periodType: "monthly" as const,
    revenue: String(profitability.revenue.total),
    operatingExpenses: String(profitability.operatingExpenses.total),
    overheadRatio: String(profitability.overheadRatio),
    netOperatingIncome: String(profitability.netOperatingIncome),
    ownerCompensation: String(profitability.ownerCompensation),
    trueNetProfit: String(profitability.trueNetProfit),
    businessFreeCash: String(cashFlow.business.freeCash),
    personalFreeCash: String(cashFlow.personal.freeCash),
    combinedFreeCash: String(cashFlow.combined.freeCash),
    excessCash: String(cashFlow.combined.excessCash),
    computedAt: new Date(),
  };

  await db.insert(financialSnapshots).values(data);

  return {
    revenue: profitability.revenue.total,
    operatingExpenses: profitability.operatingExpenses.total,
    overheadRatio: profitability.overheadRatio,
    netOperatingIncome: profitability.netOperatingIncome,
    ownerCompensation: profitability.ownerCompensation,
    trueNetProfit: profitability.trueNetProfit,
    businessFreeCash: cashFlow.business.freeCash,
    personalFreeCash: cashFlow.personal.freeCash,
    combinedFreeCash: cashFlow.combined.freeCash,
    excessCash: cashFlow.combined.excessCash,
    computedAt: data.computedAt,
    isStale: false,
  };
}

export async function getOrRefreshSnapshot(
  practiceId: string
): Promise<FinancialSnapshotData> {
  const existing = await getLatestSnapshot(practiceId);
  if (existing && !existing.isStale) return existing;
  return refreshSnapshot(practiceId);
}
