import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { users, userPractices, practices } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionOrDemo } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/audit/logger";
import { sendEmail } from "@/lib/email/client";
import { inviteEmail } from "@/lib/email/templates";
import { APP_URL } from "@/lib/config/branding";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["manager", "accountant"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: practiceId } = await params;

    // Verify the current user is an owner of this practice
    const [membership] = await db
      .select({ role: userPractices.role })
      .from(userPractices)
      .where(
        and(
          eq(userPractices.userId, session.userId),
          eq(userPractices.practiceId, practiceId)
        )
      )
      .limit(1);

    if (!membership || membership.role !== "owner") {
      return NextResponse.json(
        { error: "Only practice owners can invite users" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, role } = parsed.data;

    // Look up the user by email
    const [targetUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!targetUser) {
      return NextResponse.json(
        {
          error:
            "User not found. They must sign up first before being invited.",
        },
        { status: 404 }
      );
    }

    // Check if already a member
    const [existing] = await db
      .select({ id: userPractices.id })
      .from(userPractices)
      .where(
        and(
          eq(userPractices.userId, targetUser.id),
          eq(userPractices.practiceId, practiceId)
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "User is already a member of this practice" },
        { status: 409 }
      );
    }

    // Create the membership (pending acceptance)
    await db.insert(userPractices).values({
      userId: targetUser.id,
      practiceId,
      role,
      isDefault: false,
      invitedBy: session.userId,
      invitedAt: new Date(),
      acceptedAt: null,
    });

    // Send invite email
    const [practice] = await db
      .select({ name: practices.name })
      .from(practices)
      .where(eq(practices.id, practiceId))
      .limit(1);

    const emailContent = inviteEmail({
      inviterName: session.name,
      practiceName: practice?.name ?? "a practice",
      role,
      acceptUrl: `${APP_URL}/login`,
    });

    await sendEmail({
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
    });

    await logAuditEvent({
      practiceId,
      userId: session.userId,
      action: "invite_user",
      entityType: "user_practice",
      newValue: { email, role },
    });

    return NextResponse.json(
      { message: "Invitation sent", email, role },
      { status: 201 }
    );
  } catch (error) {
    console.error("Invite error:", error);
    return NextResponse.json(
      { error: "Failed to invite user" },
      { status: 500 }
    );
  }
}
