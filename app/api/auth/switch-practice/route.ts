import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { userPractices } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionOrDemo } from "@/lib/auth/session";
import { switchPractice } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/audit/logger";

const switchSchema = z.object({
  practiceId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = switchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { practiceId } = parsed.data;

    // Verify the user has access to the target practice
    const result = await switchPractice(session.userId, practiceId);
    if (!result) {
      return NextResponse.json(
        { error: "Practice not found or access denied" },
        { status: 403 }
      );
    }

    // Clear old default
    await db
      .update(userPractices)
      .set({ isDefault: false })
      .where(
        and(
          eq(userPractices.userId, session.userId),
          eq(userPractices.isDefault, true)
        )
      );

    // Set new default
    await db
      .update(userPractices)
      .set({ isDefault: true })
      .where(
        and(
          eq(userPractices.userId, session.userId),
          eq(userPractices.practiceId, practiceId)
        )
      );

    await logAuditEvent({
      practiceId,
      userId: session.userId,
      action: "switch_practice",
      entityType: "user_practice",
      oldValue: { practiceId: session.practiceId },
      newValue: { practiceId },
    });

    return NextResponse.json({
      practiceId: result.practiceId,
      role: result.role,
    });
  } catch (error) {
    console.error("Switch practice error:", error);
    return NextResponse.json(
      { error: "Failed to switch practice" },
      { status: 500 }
    );
  }
}
