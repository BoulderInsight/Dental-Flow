import { db } from "@/lib/db";
import { plaidAccounts, practices, netWorthSnapshots } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export interface NetWorthReport {
  asOf: Date;
  assets: {
    practiceValue: number;
    realEstate: number;
    liquidAssets: number;
    investments: number;
    retirement: number;
    otherAssets: number;
    totalAssets: number;
  };
  liabilities: {
    practiceLoan: number;
    mortgage: number;
    creditCards: number;
    otherLiabilities: number;
    totalLiabilities: number;
  };
  netWorth: number;
  monthlyTrend: Array<{ date: string; netWorth: number }>;
}

const RETIREMENT_SUBTYPES = ["401k", "ira", "roth", "retirement", "403b", "457b", "pension"];

function isRetirementAccount(subtype: string | null): boolean {
  if (!subtype) return false;
  const lower = subtype.toLowerCase();
  return RETIREMENT_SUBTYPES.some((rt) => lower.includes(rt));
}

export async function calculateNetWorth(
  practiceId: string
): Promise<NetWorthReport> {
  // Get all included Plaid accounts
  const accounts = await db
    .select()
    .from(plaidAccounts)
    .where(
      and(
        eq(plaidAccounts.practiceId, practiceId),
        eq(plaidAccounts.isIncludedInNetWorth, true)
      )
    );

  // Get manual entries from practice
  const [practice] = await db
    .select({
      estimatedValue: practices.estimatedValue,
      realEstateValue: practices.realEstateValue,
      otherAssets: practices.otherAssets,
      otherLiabilities: practices.otherLiabilities,
    })
    .from(practices)
    .where(eq(practices.id, practiceId))
    .limit(1);

  const practiceValue = parseFloat(practice?.estimatedValue || "0");
  const realEstate = parseFloat(practice?.realEstateValue || "0");
  const otherAssetsManual = parseFloat(practice?.otherAssets || "0");
  const otherLiabilitiesManual = parseFloat(practice?.otherLiabilities || "0");

  // Categorize Plaid accounts
  let liquidAssets = 0;
  let investments = 0;
  let retirement = 0;
  let practiceLoan = 0;
  let mortgage = 0;
  let creditCards = 0;

  for (const account of accounts) {
    const balance = parseFloat(account.currentBalance);
    const type = account.type.toLowerCase();
    const subtype = account.subtype?.toLowerCase() || "";

    switch (type) {
      case "depository":
        liquidAssets += balance;
        break;
      case "investment":
        if (isRetirementAccount(account.subtype)) {
          retirement += balance;
        } else {
          investments += balance;
        }
        break;
      case "loan":
        if (subtype === "mortgage") {
          mortgage += Math.abs(balance);
        } else {
          practiceLoan += Math.abs(balance);
        }
        break;
      case "credit":
        creditCards += Math.abs(balance);
        break;
    }
  }

  const totalAssets =
    practiceValue + realEstate + liquidAssets + investments + retirement + otherAssetsManual;
  const totalLiabilities =
    practiceLoan + mortgage + creditCards + otherLiabilitiesManual;
  const netWorth = totalAssets - totalLiabilities;

  // Get monthly trend from snapshots
  const snapshots = await db
    .select({
      snapshotDate: netWorthSnapshots.snapshotDate,
      netWorth: netWorthSnapshots.netWorth,
    })
    .from(netWorthSnapshots)
    .where(eq(netWorthSnapshots.practiceId, practiceId))
    .orderBy(desc(netWorthSnapshots.snapshotDate))
    .limit(24);

  const monthlyTrend = snapshots
    .reverse()
    .map((s) => ({
      date: s.snapshotDate,
      netWorth: parseFloat(s.netWorth || "0"),
    }));

  return {
    asOf: new Date(),
    assets: {
      practiceValue,
      realEstate,
      liquidAssets,
      investments,
      retirement,
      otherAssets: otherAssetsManual,
      totalAssets,
    },
    liabilities: {
      practiceLoan,
      mortgage,
      creditCards,
      otherLiabilities: otherLiabilitiesManual,
      totalLiabilities,
    },
    netWorth,
    monthlyTrend,
  };
}
