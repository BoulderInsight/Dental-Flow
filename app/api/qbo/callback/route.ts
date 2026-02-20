import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "@/lib/qbo/demo-mode";
import { exchangeCode } from "@/lib/qbo/client";
import { storeTokens } from "@/lib/qbo/token-manager";
import { db } from "@/lib/db";
import { practices } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  if (isDemoMode()) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  try {
    const { accessToken, refreshToken, realmId } = await exchangeCode(
      request.url
    );

    // Find or create practice for this realm
    let [practice] = await db
      .select()
      .from(practices)
      .where(eq(practices.qboRealmId, realmId));

    if (!practice) {
      [practice] = await db
        .insert(practices)
        .values({
          name: "My Practice",
          qboRealmId: realmId,
        })
        .returning();
    }

    await storeTokens(practice.id, accessToken, refreshToken);

    return NextResponse.redirect(new URL("/?connected=true", request.url));
  } catch (error) {
    console.error("QBO callback error:", error);
    return NextResponse.redirect(new URL("/?error=qbo_connect", request.url));
  }
}
