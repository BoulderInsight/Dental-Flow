import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "@/lib/qbo/demo-mode";
import { exchangeCode } from "@/lib/qbo/client";
import { storeTokens } from "@/lib/qbo/token-manager";
import { db } from "@/lib/db";
import { practices } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionOrDemo } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  if (isDemoMode()) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const session = await getSessionOrDemo();
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const { accessToken, refreshToken, realmId } = await exchangeCode(
      request.url
    );

    // Update the practice with QBO realm
    await db
      .update(practices)
      .set({ qboRealmId: realmId })
      .where(eq(practices.id, session.practiceId));

    await storeTokens(session.practiceId, accessToken, refreshToken);

    return NextResponse.redirect(new URL("/?connected=true", request.url));
  } catch (error) {
    console.error("QBO callback error:", error);
    return NextResponse.redirect(new URL("/?error=qbo_connect", request.url));
  }
}
