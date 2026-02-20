import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, userPractices } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionOrDemo } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/audit/logger";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: practiceId } = await params;

    // Verify the current user has access (owner or manager)
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

    if (!membership || membership.role === "accountant") {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    const members = await db
      .select({
        id: userPractices.id,
        userId: users.id,
        email: users.email,
        name: users.name,
        role: userPractices.role,
        invitedAt: userPractices.invitedAt,
        acceptedAt: userPractices.acceptedAt,
        createdAt: userPractices.createdAt,
      })
      .from(userPractices)
      .innerJoin(users, eq(userPractices.userId, users.id))
      .where(eq(userPractices.practiceId, practiceId));

    return NextResponse.json(members);
  } catch (error) {
    console.error("Get members error:", error);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: practiceId } = await params;

    // Verify the current user is an owner
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
        { error: "Only practice owners can remove members" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const membershipId = searchParams.get("membershipId");
    if (!membershipId) {
      return NextResponse.json(
        { error: "membershipId is required" },
        { status: 400 }
      );
    }

    // Prevent removing yourself
    const [target] = await db
      .select({
        userId: userPractices.userId,
        role: userPractices.role,
      })
      .from(userPractices)
      .where(eq(userPractices.id, membershipId))
      .limit(1);

    if (!target) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    if (target.userId === session.userId) {
      return NextResponse.json(
        { error: "Cannot remove yourself from the practice" },
        { status: 400 }
      );
    }

    await db
      .delete(userPractices)
      .where(eq(userPractices.id, membershipId));

    await logAuditEvent({
      practiceId,
      userId: session.userId,
      action: "remove_member",
      entityType: "user_practice",
      entityId: membershipId,
      oldValue: { userId: target.userId, role: target.role },
    });

    return NextResponse.json({ message: "Member removed" });
  } catch (error) {
    console.error("Remove member error:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}
