import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { requireRole, PermissionError } from "@/lib/auth/permissions";
import { getQBOAccounts } from "@/lib/qbo/account-mapping-config";

export async function GET() {
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

    const accounts = await getQBOAccounts(session.practiceId);
    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("QBO accounts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch QBO accounts" },
      { status: 500 }
    );
  }
}
