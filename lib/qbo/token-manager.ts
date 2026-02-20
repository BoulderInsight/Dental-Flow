import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { practices } from "@/lib/db/schema";
import { encrypt, decrypt } from "./encryption";
import { refreshTokens } from "./client";

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix ms
  refreshedAt: number; // unix ms
}

export async function storeTokens(
  practiceId: string,
  accessToken: string,
  refreshToken: string
): Promise<void> {
  const tokens: StoredTokens = {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + 60 * 60 * 1000, // 60 min from now
    refreshedAt: Date.now(),
  };

  const encrypted = encrypt(JSON.stringify(tokens));

  await db
    .update(practices)
    .set({ qboTokens: encrypted, updatedAt: new Date() })
    .where(eq(practices.id, practiceId));
}

export async function getValidTokens(
  practiceId: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const [practice] = await db
    .select({ qboTokens: practices.qboTokens })
    .from(practices)
    .where(eq(practices.id, practiceId));

  if (!practice?.qboTokens) return null;

  const tokens: StoredTokens = JSON.parse(decrypt(practice.qboTokens));

  // Proactive refresh at 50-minute mark (tokens expire at 60 min)
  const fiftyMinMark = tokens.refreshedAt + 50 * 60 * 1000;
  if (Date.now() >= fiftyMinMark) {
    const newTokens = await refreshTokens(tokens.refreshToken);
    await storeTokens(practiceId, newTokens.accessToken, newTokens.refreshToken);
    return newTokens;
  }

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}
