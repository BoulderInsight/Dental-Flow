import type { IndustryConfig } from "@/lib/industries/types";

export interface AccountMappingResult {
  category: "business" | "personal" | "ambiguous";
  confidence: number;
  reasoning: string;
}

const BUSINESS_ACCOUNTS = new Set([
  "lab fees",
  "dental supplies",
  "payroll",
  "payroll expenses",
  "rent",
  "rent or lease",
  "utilities",
  "insurance",
  "professional fees",
  "professional",
  "continuing education",
  "education",
  "marketing",
  "advertising",
  "equipment",
  "equipment rental",
  "instruments",
  "services",
  "medical waste",
  "uniforms",
  "software",
]);

const PERSONAL_ACCOUNTS = new Set([
  "entertainment",
  "fitness",
  "personal",
  "owner's draw",
  "owner's personal",
  "personal expenses",
]);

const AMBIGUOUS_ACCOUNTS = new Set([
  "supplies",
  "office supplies",
  "food",
  "meals",
  "meals and entertainment",
  "subscriptions",
  "miscellaneous",
  "other expenses",
  "uncategorized",
  "office",
]);

/**
 * Categorize a transaction based on its QBO account reference.
 * Returns null if the account is unknown or not provided.
 */
export function categorizeByAccount(
  accountRef: string | null
): AccountMappingResult | null {
  if (!accountRef) return null;

  const lower = accountRef.toLowerCase();

  if (BUSINESS_ACCOUNTS.has(lower)) {
    return {
      category: "business",
      confidence: 95,
      reasoning: `QBO account "${accountRef}" is a known business account`,
    };
  }

  if (PERSONAL_ACCOUNTS.has(lower)) {
    return {
      category: "personal",
      confidence: 90,
      reasoning: `QBO account "${accountRef}" is a known personal account`,
    };
  }

  if (AMBIGUOUS_ACCOUNTS.has(lower)) {
    return {
      category: "ambiguous",
      confidence: 50,
      reasoning: `QBO account "${accountRef}" is ambiguous — could be business or personal`,
    };
  }

  return null;
}

/**
 * Categorize a transaction based on its QBO account reference using an IndustryConfig.
 * Falls back to the original hardcoded function if no config provided.
 */
export function categorizeByAccountWithConfig(
  accountRef: string | null,
  config: IndustryConfig
): AccountMappingResult | null {
  if (!accountRef) return null;

  const lower = accountRef.toLowerCase();
  const mappings = config.accountMappings;

  const businessSet = new Set(mappings.business.map((a) => a.toLowerCase()));
  const personalSet = new Set(mappings.personal.map((a) => a.toLowerCase()));
  const ambiguousSet = new Set(mappings.ambiguous.map((a) => a.toLowerCase()));

  if (businessSet.has(lower)) {
    return {
      category: "business",
      confidence: 95,
      reasoning: `QBO account "${accountRef}" is a known business account`,
    };
  }

  if (personalSet.has(lower)) {
    return {
      category: "personal",
      confidence: 90,
      reasoning: `QBO account "${accountRef}" is a known personal account`,
    };
  }

  if (ambiguousSet.has(lower)) {
    return {
      category: "ambiguous",
      confidence: 50,
      reasoning: `QBO account "${accountRef}" is ambiguous — could be business or personal`,
    };
  }

  return null;
}
