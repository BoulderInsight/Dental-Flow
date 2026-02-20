import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { calculateNetWorth } from "@/lib/finance/net-worth";
import { db } from "@/lib/db";
import { netWorthSnapshots } from "@/lib/db/schema";
import { logAuditEvent } from "@/lib/audit/logger";

export async function POST() {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const report = await calculateNetWorth(session.practiceId);

    const today = new Date().toISOString().slice(0, 10);

    await db.insert(netWorthSnapshots).values({
      practiceId: session.practiceId,
      snapshotDate: today,
      practiceValue: String(report.assets.practiceValue),
      realEstateValue: String(report.assets.realEstate),
      investmentValue: String(report.assets.investments),
      retirementValue: String(report.assets.retirement),
      liquidAssets: String(report.assets.liquidAssets),
      totalLiabilities: String(report.liabilities.totalLiabilities),
      netWorth: String(report.netWorth),
    });

    await logAuditEvent({
      practiceId: session.practiceId,
      userId: session.userId,
      action: "net_worth_snapshot_created",
      entityType: "net_worth_snapshot",
      newValue: { netWorth: report.netWorth, date: today },
    });

    return NextResponse.json({ success: true, netWorth: report.netWorth });
  } catch (error) {
    console.error("Net worth snapshot error:", error);
    return NextResponse.json(
      { error: "Failed to create snapshot" },
      { status: 500 }
    );
  }
}
