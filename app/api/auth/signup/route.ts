import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users, practices, userPractices } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const signupSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  practiceName: z.string().min(1).max(200),
  industry: z.string().min(1).max(100).default("dental"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, email, password, practiceName, industry } = parsed.data;

    // Check for existing user
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    // Create practice with optional industry
    const [practice] = await db
      .insert(practices)
      .values({
        name: practiceName,
        industry,
      })
      .returning();

    // Create user (keep practiceId and role on users table for backward compat)
    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db
      .insert(users)
      .values({
        practiceId: practice.id,
        email,
        name,
        passwordHash,
        role: "owner",
      })
      .returning({ id: users.id });

    // Create userPractices join row for multi-practice support
    await db.insert(userPractices).values({
      userId: user.id,
      practiceId: practice.id,
      role: "owner",
      isDefault: true,
      acceptedAt: new Date(),
    });

    return NextResponse.json({ userId: user.id }, { status: 201 });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
