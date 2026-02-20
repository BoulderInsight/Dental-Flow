import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  notificationPreferences,
  users,
  userPractices,
  practices,
  transactions,
  categorizations,
  taxAlerts,
} from "@/lib/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { calculateFreeCashFlow } from "@/lib/finance/cash-flow";
import { sendEmail } from "@/lib/email/client";
import { weeklyInsightsEmail } from "@/lib/email/templates";

export async function POST() {
  try {
    // Get all users who opted in to weekly insights
    const subscribers = await db
      .select({
        userId: notificationPreferences.userId,
        email: users.email,
      })
      .from(notificationPreferences)
      .innerJoin(users, eq(users.id, notificationPreferences.userId))
      .where(eq(notificationPreferences.emailWeeklyInsights, true));

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

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        // Count transactions categorized this week
        const [catCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(categorizations)
          .innerJoin(transactions, eq(transactions.id, categorizations.transactionId))
          .where(
            and(
              eq(transactions.practiceId, membership.practiceId),
              gte(categorizations.createdAt, weekAgo)
            )
          );

        // Get cash position from cash flow module
        const cashFlow = await calculateFreeCashFlow(membership.practiceId, 1);

        // Get upcoming tax deadlines (alerts expiring in next 30 days)
        const thirtyDaysOut = new Date();
        thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

        const upcomingAlerts = await db
          .select({ title: taxAlerts.title, expiresAt: taxAlerts.expiresAt })
          .from(taxAlerts)
          .where(
            and(
              eq(taxAlerts.practiceId, membership.practiceId),
              eq(taxAlerts.isDismissed, false),
              gte(taxAlerts.expiresAt, new Date()),
              sql`${taxAlerts.expiresAt} <= ${thirtyDaysOut}`
            )
          )
          .limit(5);

        const weekOfDate = weekAgo.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
        });

        const emailContent = weeklyInsightsEmail({
          weekOf: weekOfDate,
          transactionsCategorized: catCount?.count ?? 0,
          cashPosition: cashFlow.combined.freeCash,
          upcomingDeadlines: upcomingAlerts.map(
            (a) =>
              `${a.title}${a.expiresAt ? ` (due ${new Date(a.expiresAt).toLocaleDateString()})` : ""}`
          ),
        });

        const result = await sendEmail({
          to: subscriber.email,
          subject: emailContent.subject,
          html: emailContent.html,
        });

        if (result.success) sent++;
        else failed++;
      } catch (err) {
        console.error(`Weekly email failed for user ${subscriber.userId}:`, err);
        failed++;
      }
    }

    return NextResponse.json({
      message: "Weekly insights sent",
      sent,
      failed,
      total: subscribers.length,
    });
  } catch (error) {
    console.error("Send weekly error:", error);
    return NextResponse.json(
      { error: "Failed to send weekly insight emails" },
      { status: 500 }
    );
  }
}
