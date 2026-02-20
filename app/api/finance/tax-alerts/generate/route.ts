import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taxAlerts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionOrDemo } from "@/lib/auth/session";
import { requireRole, PermissionError } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/logger";
import { generateTaxAlerts } from "@/lib/finance/tax-strategy";

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      requireRole(session, "write");
    } catch (e) {
      if (e instanceof PermissionError) {
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 }
        );
      }
      throw e;
    }

    const { searchParams } = new URL(request.url);
    const taxYear = parseInt(
      searchParams.get("taxYear") || String(new Date().getFullYear()),
      10
    );

    // Delete existing alerts for this practice/year (regenerate)
    await db
      .delete(taxAlerts)
      .where(
        and(
          eq(taxAlerts.practiceId, session.practiceId),
          eq(taxAlerts.taxYear, taxYear)
        )
      );

    // Generate fresh alerts
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
    }

    // Fetch inserted alerts (with IDs)
    const alerts = await db
      .select()
      .from(taxAlerts)
      .where(
        and(
          eq(taxAlerts.practiceId, session.practiceId),
          eq(taxAlerts.taxYear, taxYear)
        )
      );

    await logAuditEvent({
      practiceId: session.practiceId,
      userId: session.userId,
      action: "regenerate_tax_alerts",
      entityType: "tax_alert",
      newValue: { taxYear, alertCount: alerts.length },
    });

    return NextResponse.json({ alerts, taxYear });
  } catch (error) {
    console.error("Generate tax alerts error:", error);
    return NextResponse.json(
      { error: "Failed to generate tax alerts" },
      { status: 500 }
    );
  }
}
