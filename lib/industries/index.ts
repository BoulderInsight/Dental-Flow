import type { IndustryConfig } from "./types";
import { dentalConfig } from "./dental";
import { chiropracticConfig } from "./chiropractic";
import { veterinaryConfig } from "./veterinary";
import { generalConfig } from "./general";
import { db } from "@/lib/db";
import { industryConfigs, practices } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

// Static registry of curated industry configs
const STATIC_CONFIGS: Record<string, IndustryConfig> = {
  dental: dentalConfig,
  chiropractic: chiropracticConfig,
  veterinary: veterinaryConfig,
  general: generalConfig,
};

/**
 * Get an IndustryConfig by slug.
 * Checks static registry first, then DB for custom configs, then falls back to general.
 */
export async function getIndustryConfig(slug: string): Promise<IndustryConfig> {
  // Check static registry first
  if (STATIC_CONFIGS[slug]) {
    return STATIC_CONFIGS[slug];
  }

  // Check DB for custom/AI-generated configs (global, not practice-specific)
  const [row] = await db
    .select({ configJson: industryConfigs.configJson })
    .from(industryConfigs)
    .where(
      and(
        eq(industryConfigs.industrySlug, slug),
        isNull(industryConfigs.practiceId)
      )
    )
    .limit(1);

  if (row?.configJson) {
    return row.configJson as IndustryConfig;
  }

  // Fall back to general config
  return generalConfig;
}

/**
 * Get the IndustryConfig for a specific practice.
 * Checks for practice-level override first, then resolves by practice's industry slug.
 */
export async function getConfigForPractice(
  practiceId: string
): Promise<IndustryConfig> {
  // Check for practice-level override
  const [override] = await db
    .select({ configJson: industryConfigs.configJson })
    .from(industryConfigs)
    .where(eq(industryConfigs.practiceId, practiceId))
    .limit(1);

  if (override?.configJson) {
    return override.configJson as IndustryConfig;
  }

  // Look up the practice's industry slug
  const [practice] = await db
    .select({ industry: practices.industry })
    .from(practices)
    .where(eq(practices.id, practiceId))
    .limit(1);

  const slug = practice?.industry || "dental";
  return getIndustryConfig(slug);
}

/**
 * Get a static config synchronously (for backward compatibility).
 * Only returns configs from the static registry.
 */
export function getStaticConfig(slug: string): IndustryConfig {
  return STATIC_CONFIGS[slug] || generalConfig;
}

/**
 * List all available industry slugs from the static registry.
 */
export function getAvailableIndustries(): Array<{ slug: string; name: string }> {
  return Object.values(STATIC_CONFIGS).map((c) => ({
    slug: c.slug,
    name: c.name,
  }));
}

export { dentalConfig, chiropracticConfig, veterinaryConfig, generalConfig };
export type { IndustryConfig };
