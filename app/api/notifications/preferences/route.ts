import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { notificationPreferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionOrDemo } from "@/lib/auth/session";

const updateSchema = z.object({
  emailInvites: z.boolean().optional(),
  emailTaxAlerts: z.boolean().optional(),
  emailMonthlyDigest: z.boolean().optional(),
  emailReferralOpportunities: z.boolean().optional(),
  emailWeeklyInsights: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find or create default preferences
    let [prefs] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, session.userId))
      .limit(1);

    if (!prefs) {
      const [created] = await db
        .insert(notificationPreferences)
        .values({ userId: session.userId })
        .returning();
      prefs = created;
    }

    return NextResponse.json(prefs);
  } catch (error) {
    console.error("Notification preferences GET error:", error);
    return NextResponse.json(
      { error: "Failed to load notification preferences" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    // Ensure preferences exist
    const [existing] = await db
      .select({ id: notificationPreferences.id })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, session.userId))
      .limit(1);

    if (!existing) {
      await db
        .insert(notificationPreferences)
        .values({ userId: session.userId });
    }

    const [updated] = await db
      .update(notificationPreferences)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(notificationPreferences.userId, session.userId))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Notification preferences PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update notification preferences" },
      { status: 500 }
    );
  }
}
