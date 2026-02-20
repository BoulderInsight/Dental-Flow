import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/qbo/demo-mode";
import { generateAuthUrl } from "@/lib/qbo/client";
import { getSessionOrDemo } from "@/lib/auth/session";

export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json(
      { error: "QBO not configured — running in demo mode" },
      { status: 400 }
    );
  }

  const session = await getSessionOrDemo();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authUrl = generateAuthUrl();
  return NextResponse.redirect(authUrl);
}
