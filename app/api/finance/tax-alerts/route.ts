import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taxAlerts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionOrDemo } from "@/lib/auth/session";
import { generateTaxAlerts } from "@/lib/finance/tax-strategy";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const taxYear = parseInt(
      searchParams.get("taxYear") || String(new Date().getFullYear()),
      10
    );

    // Check if alerts exist for this practice and year
    const existing = await db
      .select()
      .from(taxAlerts)
      .where(
        and(
          eq(taxAlerts.practiceId, session.practiceId),
          eq(taxAlerts.taxYear, taxYear)
        )
      );

    // If no alerts exist, generate them on-demand
    if (existing.length === 0) {
      const generated = await generateTaxAlerts(session.practiceId, taxYear);

      if (generated.length > 0) {
        const insertValues = generated.map((alert) => ({
          practiceId: session.practiceId,
          alertType: alert.type,
          title: alert.title,
          description: alert.description,
          priority: alert.priority,
          taxYear,
          expiresAt: alert.deadline || null,
          metadata: {
            potentialSavings: alert.potentialSavings,
            deadline: alert.deadline?.toISOString(),
            actionItems: alert.actionItems,
            ...alert.metadata,
          },
        }));

        await db.insert(taxAlerts).values(insertValues);

        // Re-fetch to get IDs
        const inserted = await db
          .select()
          .from(taxAlerts)
          .where(
            and(
              eq(taxAlerts.practiceId, session.practiceId),
              eq(taxAlerts.taxYear, taxYear)
            )
          );

        return NextResponse.json({ alerts: inserted, taxYear });
      }

      return NextResponse.json({ alerts: [], taxYear });
    }

    return NextResponse.json({ alerts: existing, taxYear });
  } catch (error) {
    console.error("Tax alerts error:", error);
    return NextResponse.json(
      { error: "Failed to load tax alerts" },
      { status: 500 }
    );
  }
}
