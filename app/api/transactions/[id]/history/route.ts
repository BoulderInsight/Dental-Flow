import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { categorizations } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSessionOrDemo } from "@/lib/auth/session";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: transactionId } = await params;

    const history = await db
      .select()
      .from(categorizations)
      .where(eq(categorizations.transactionId, transactionId))
      .orderBy(desc(categorizations.createdAt));

    return NextResponse.json(history);
  } catch (error) {
    console.error("History fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}
