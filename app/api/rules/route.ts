import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { userRules } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionOrDemo } from "@/lib/auth/session";
import { requireRole, PermissionError } from "@/lib/auth/permissions";

const createRuleSchema = z.object({
  matchType: z.enum(["vendor", "description", "amount_range"]),
  matchValue: z.string().min(1),
  category: z.enum(["business", "personal", "ambiguous"]),
  priority: z.number().int().optional(),
});

export async function GET() {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rules = await db
      .select()
      .from(userRules)
      .where(eq(userRules.practiceId, session.practiceId))
      .orderBy(userRules.priority);

    return NextResponse.json(rules);
  } catch (error) {
    console.error("Rules fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch rules" },
      { status: 500 }
    );
  }
}

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
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
      throw e;
    }

    const body = await request.json();
    const parsed = createRuleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const [rule] = await db
      .insert(userRules)
      .values({
        practiceId: session.practiceId,
        matchType: parsed.data.matchType,
        matchValue: parsed.data.matchValue,
        category: parsed.data.category,
        priority: parsed.data.priority ?? 0,
      })
      .returning();

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error("Rule creation error:", error);
    return NextResponse.json(
      { error: "Failed to create rule" },
      { status: 500 }
    );
  }
}
