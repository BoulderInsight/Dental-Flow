import { auth } from "./config";
import { isDemoMode } from "@/lib/qbo/demo-mode";
import { db } from "@/lib/db";
import { practices } from "@/lib/db/schema";

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
