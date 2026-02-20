import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionOrDemo } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/audit/logger";
import { getConfigForPractice } from "@/lib/industries";
import { db } from "@/lib/db";
import { industryConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const industryConfigSchema = z.object({
  slug: z.string(),
  name: z.string(),
  vendors: z.object({
    business: z.array(z.string()),
    personal: z.array(z.string()),
    ambiguous: z.array(z.string()),
    patterns: z.array(z.string()),
  }),
  seasonality: z.array(z.number()).length(12),
  benchmarks: z.object({
    overheadRatio: z.object({
      healthy: z.number(),
      target: z.tuple([z.number(), z.number()]),
      elevated: z.number(),
      critical: z.number(),
    }),
  }),
  accountMappings: z.object({
    business: z.array(z.string()),
    personal: z.array(z.string()),
    ambiguous: z.array(z.string()),
  }),
  debtServicePatterns: z.array(z.string()),
  ownerDrawPatterns: z.array(z.string()),
});

export async function GET() {
  const session = await getSessionOrDemo();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getConfigForPractice(session.practiceId);
  return NextResponse.json(config);
}

export async function PUT(request: NextRequest) {
  const session = await getSessionOrDemo();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = industryConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const config = parsed.data;

  // Check for existing practice-level override
  const [existing] = await db
    .select({ id: industryConfigs.id })
    .from(industryConfigs)
    .where(eq(industryConfigs.practiceId, session.practiceId))
    .limit(1);

  if (existing) {
    await db
      .update(industryConfigs)
      .set({
        configJson: config,
        industrySlug: config.slug,
        isCustom: true,
        updatedAt: new Date(),
      })
      .where(eq(industryConfigs.id, existing.id));
  } else {
    await db.insert(industryConfigs).values({
      practiceId: session.practiceId,
      industrySlug: config.slug,
      configJson: config,
      isCustom: true,
    });
  }

  await logAuditEvent({
    practiceId: session.practiceId,
    userId: session.userId,
    action: "update_industry_config",
    entityType: "industry_config",
    entityId: config.slug,
    newValue: config,
  });

  return NextResponse.json(config);
}
