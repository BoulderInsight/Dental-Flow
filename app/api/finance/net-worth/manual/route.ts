import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { practices } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit/logger";
import { z } from "zod";

const manualSchema = z.object({
  practiceValue: z.number().optional(),
  realEstateValue: z.number().optional(),
  otherAssets: z.number().optional(),
  otherLiabilities: z.number().optional(),
});

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = manualSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const updates: Record<string, string> = {};
    if (parsed.data.practiceValue !== undefined) {
      updates.estimatedValue = String(parsed.data.practiceValue);
    }
    if (parsed.data.realEstateValue !== undefined) {
      updates.realEstateValue = String(parsed.data.realEstateValue);
    }
    if (parsed.data.otherAssets !== undefined) {
      updates.otherAssets = String(parsed.data.otherAssets);
    }
    if (parsed.data.otherLiabilities !== undefined) {
      updates.otherLiabilities = String(parsed.data.otherLiabilities);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    await db
      .update(practices)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(practices.id, session.practiceId));

    await logAuditEvent({
      practiceId: session.practiceId,
      userId: session.userId,
      action: "net_worth_manual_updated",
      entityType: "practice",
      entityId: session.practiceId,
      newValue: parsed.data,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Manual net worth update error:", error);
    return NextResponse.json(
      { error: "Failed to update manual values" },
      { status: 500 }
    );
  }
}
