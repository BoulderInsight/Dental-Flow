import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { plaidAccounts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  isIncludedInNetWorth: z.boolean(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Verify practice ownership
    const [account] = await db
      .select({ id: plaidAccounts.id })
      .from(plaidAccounts)
      .where(
        and(
          eq(plaidAccounts.id, id),
          eq(plaidAccounts.practiceId, session.practiceId)
        )
      )
      .limit(1);

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    await db
      .update(plaidAccounts)
      .set({ isIncludedInNetWorth: parsed.data.isIncludedInNetWorth })
      .where(eq(plaidAccounts.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Plaid account update error:", error);
    return NextResponse.json(
      { error: "Failed to update account" },
      { status: 500 }
    );
  }
}
