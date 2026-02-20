import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  notificationPreferences,
  users,
  userPractices,
  practices,
  taxAlerts,
  referralOpportunities,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { calculateProfitability } from "@/lib/finance/profitability";
import { calculateFreeCashFlow } from "@/lib/finance/cash-flow";
import { sendEmail } from "@/lib/email/client";
import { monthlyDigestEmail } from "@/lib/email/templates";

export async function POST() {
  try {
    // Get all users who opted in to monthly digest
    const subscribers = await db
      .select({
        userId: notificationPreferences.userId,
        email: users.email,
      })
      .from(notificationPreferences)
      .innerJoin(users, eq(users.id, notificationPreferences.userId))
      .where(eq(notificationPreferences.emailMonthlyDigest, true));

    let sent = 0;
    let failed = 0;

    for (const subscriber of subscribers) {
      try {
        // Get the user's default practice
        const [membership] = await db
          .select({
            practiceId: userPractices.practiceId,
            practiceName: practices.name,
          })
          .from(userPractices)
          .innerJoin(practices, eq(practices.id, userPractices.practiceId))
          .where(
            and(
              eq(userPractices.userId, subscriber.userId),
              eq(userPractices.isDefault, true)
            )
          )
          .limit(1);

        if (!membership) continue;

        // Calculate current month and prior month date ranges
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const currentMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        const priorMonthStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        const priorMonthEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0);

        const [profitability, priorProfitability, cashFlow] = await Promise.all([
          calculateProfitability(membership.practiceId, currentMonthStart, currentMonthEnd),
          calculateProfitability(membership.practiceId, priorMonthStart, priorMonthEnd),
          calculateFreeCashFlow(membership.practiceId, 1),
        ]);

        // Count active tax alerts
        const [alertCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(taxAlerts)
          .where(
            and(
              eq(taxAlerts.practiceId, membership.practiceId),
              eq(taxAlerts.isDismissed, false)
            )
          );

        // Count active referral opportunities
        const [oppCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(referralOpportunities)
          .where(
            and(
              eq(referralOpportunities.practiceId, membership.practiceId),
              eq(referralOpportunities.status, "detected")
            )
          );

        const revenueChange =
          priorProfitability.revenue.total > 0
            ? ((profitability.revenue.total - priorProfitability.revenue.total) /
                priorProfitability.revenue.total) *
              100
            : 0;

        const monthName = currentMonthStart.toLocaleString("en-US", {
          month: "long",
          year: "numeric",
        });

        const emailContent = monthlyDigestEmail({
          month: monthName,
          revenue: profitability.revenue.total,
          expenses: profitability.operatingExpenses.total,
          netProfit: profitability.trueNetProfit,
          overheadRatio: profitability.overheadRatio,
          freeCashFlow: cashFlow.combined.freeCash,
          revenueChange,
          taxAlertCount: alertCount?.count ?? 0,
          opportunityCount: oppCount?.count ?? 0,
        });

        const result = await sendEmail({
          to: subscriber.email,
          subject: emailContent.subject,
          html: emailContent.html,
        });

        if (result.success) sent++;
        else failed++;
      } catch (err) {
        console.error(`Digest email failed for user ${subscriber.userId}:`, err);
        failed++;
      }
    }

    return NextResponse.json({
      message: "Monthly digest sent",
      sent,
      failed,
      total: subscribers.length,
    });
  } catch (error) {
    console.error("Send digest error:", error);
    return NextResponse.json(
      { error: "Failed to send digest emails" },
      { status: 500 }
    );
  }
}
