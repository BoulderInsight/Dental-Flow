import { NextResponse } from "next/server";
import { categorizeUncategorized } from "@/lib/categorization/engine";
import { getSessionOrDemo } from "@/lib/auth/session";
import { requireRole, PermissionError } from "@/lib/auth/permissions";

export async function POST() {
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

    const result = await categorizeUncategorized(session.practiceId);

    return NextResponse.json({
      ...result,
      message: `Categorized ${result.categorized} transactions, ${result.uncategorized} remain uncategorized`,
    });
  } catch (error) {
    console.error("Categorization error:", error);
    return NextResponse.json(
      { error: "Categorization failed" },
      { status: 500 }
    );
  }
}
