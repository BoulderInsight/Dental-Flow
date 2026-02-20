import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/qbo/demo-mode";
import { generateAuthUrl } from "@/lib/qbo/client";

export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json(
      { error: "QBO not configured — running in demo mode" },
      { status: 400 }
    );
  }

  const authUrl = generateAuthUrl();
  return NextResponse.redirect(authUrl);
}
