import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { practices, userPractices } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionOrDemo } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/audit/logger";

export async function GET() {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results = await db
      .select({
        id: practices.id,
        name: practices.name,
        industry: practices.industry,
        role: userPractices.role,
        isDefault: userPractices.isDefault,
      })
      .from(userPractices)
      .innerJoin(practices, eq(userPractices.practiceId, practices.id))
      .where(eq(userPractices.userId, session.userId));

    return NextResponse.json(results);
  } catch (error) {
    console.error("Get practices error:", error);
    return NextResponse.json(
      { error: "Failed to fetch practices" },
      { status: 500 }
    );
  }
}

const createPracticeSchema = z.object({
  name: z.string().min(1).max(200),
  industry: z.string().min(1).max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createPracticeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, industry } = parsed.data;

    const [practice] = await db
      .insert(practices)
      .values({
        name,
        industry: industry ?? "dental",
      })
      .returning();

    await db.insert(userPractices).values({
      userId: session.userId,
      practiceId: practice.id,
      role: "owner",
      isDefault: false,
      acceptedAt: new Date(),
    });

    await logAuditEvent({
      practiceId: practice.id,
      userId: session.userId,
      action: "create_practice",
      entityType: "practice",
      entityId: practice.id,
      newValue: { name, industry: industry ?? "dental" },
    });

    return NextResponse.json(
      { id: practice.id, name: practice.name, industry: practice.industry },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create practice error:", error);
    return NextResponse.json(
      { error: "Failed to create practice" },
      { status: 500 }
    );
  }
}
