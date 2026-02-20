import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getSessionOrDemo } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/audit/logger";
import { db } from "@/lib/db";
import { industryConfigs } from "@/lib/db/schema";

const requestSchema = z.object({
  industryName: z.string().min(1).max(200),
});

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

const SYSTEM_PROMPT = `You are an expert business financial analyst. Generate a complete industry configuration for a small business accounting categorization system. Return ONLY valid JSON matching the exact schema described, with no additional text or markdown.`;

function buildUserPrompt(industryName: string): string {
  return `Generate an IndustryConfig JSON object for: "${industryName}"

The config must include:
1. slug: a URL-safe lowercase identifier (e.g., "plumbing", "optometry")
2. name: display name for the industry
3. vendors.business: array of 15-30 well-known vendors/suppliers specific to this industry, plus common payroll processors (ADP, Gusto, Paychex, QuickBooks Payroll, Intuit Payroll)
4. vendors.personal: common personal subscription/entertainment vendors (Netflix, Spotify, Hulu, Disney+, HBO Max, Apple TV, Amazon Prime Video, YouTube Premium, Peacock, Paramount+, Peloton, DoorDash, Uber Eats, Grubhub, Postmates, HelloFresh, Blue Apron, Starbucks)
5. vendors.ambiguous: common retail stores that could be business or personal (Amazon, Walmart, Target, Costco, Sam's Club, Staples, Office Depot, Best Buy, Apple Store)
6. vendors.patterns: 4-8 industry-specific keyword patterns for vendor matching, plus personal patterns (gym, fitness, meal kit, streaming)
7. seasonality: array of exactly 12 numbers representing monthly revenue indices (1.0 = average). Reflect actual seasonal patterns for this industry. Must sum to approximately 12.0.
8. benchmarks.overheadRatio: object with healthy (below this is excellent), target (tuple of [min, max] for normal range), elevated (above target max but below this), critical (same as elevated, threshold for critical)
9. accountMappings.business: QBO account names that are always business expenses for this industry (lowercase)
10. accountMappings.personal: QBO account names that are always personal (lowercase)
11. accountMappings.ambiguous: QBO account names that could be either (lowercase)
12. debtServicePatterns: patterns to identify debt service transactions (loan payment, note payable, etc.)
13. ownerDrawPatterns: patterns to identify owner draws/distributions

Return ONLY the JSON object, no markdown fences.`;
}

export async function POST(request: NextRequest) {
  const session = await getSessionOrDemo();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { industryName } = parsed.data;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI generation not configured" },
      { status: 503 }
    );
  }

  try {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: buildUserPrompt(industryName),
        },
      ],
      system: SYSTEM_PROMPT,
    });

    // Extract text content from the response
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "Failed to generate industry config" },
        { status: 500 }
      );
    }

    // Parse and validate the response JSON
    let configData: unknown;
    try {
      configData = JSON.parse(textBlock.text);
    } catch {
      return NextResponse.json(
        { error: "AI returned invalid JSON" },
        { status: 500 }
      );
    }

    const validated = industryConfigSchema.safeParse(configData);
    if (!validated.success) {
      return NextResponse.json(
        { error: "AI returned config that failed validation" },
        { status: 500 }
      );
    }

    const config = validated.data;

    // Store in industry_configs table
    await db.insert(industryConfigs).values({
      practiceId: session.practiceId,
      industrySlug: config.slug,
      configJson: config,
      isCustom: true,
    });

    await logAuditEvent({
      practiceId: session.practiceId,
      userId: session.userId,
      action: "generate_industry_config",
      entityType: "industry_config",
      entityId: config.slug,
      newValue: { industryName, slug: config.slug },
    });

    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    console.error("Industry generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate industry config" },
      { status: 500 }
    );
  }
}
