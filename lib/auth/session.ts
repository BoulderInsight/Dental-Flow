import { auth } from "./config";
import { isDemoMode } from "@/lib/qbo/demo-mode";
import { db } from "@/lib/db";
import { practices, userPractices } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export interface AppSession {
  userId: string;
  practiceId: string;
  role: string;
  email: string;
  name: string;
}

/**
 * Returns the current user session, or a mock session in demo mode.
 * Returns null if not authenticated and not in demo mode.
 */
export async function getSessionOrDemo(): Promise<AppSession | null> {
  if (isDemoMode()) {
    const [practice] = await db
      .select({ id: practices.id })
      .from(practices)
      .limit(1);

    if (!practice) return null;

    return {
      userId: "demo-user",
      practiceId: practice.id,
      role: "owner",
      email: "demo@dentalflow.dev",
      name: "Demo User",
    };
  }

  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    userId: session.user.id,
    practiceId: session.user.practiceId,
    role: session.user.role,
    email: session.user.email!,
    name: session.user.name!,
  };
}

/**
 * Verifies a user has access to a practice and returns their role.
 * Does NOT modify the JWT directly — the API route handles session refresh.
 */
export async function switchPractice(
  userId: string,
  practiceId: string
): Promise<{ practiceId: string; role: string } | null> {
  const [membership] = await db
    .select({
      practiceId: userPractices.practiceId,
      role: userPractices.role,
    })
    .from(userPractices)
    .where(
      and(
        eq(userPractices.userId, userId),
        eq(userPractices.practiceId, practiceId)
      )
    )
    .limit(1);

  if (!membership) return null;

  return { practiceId: membership.practiceId, role: membership.role };
}
