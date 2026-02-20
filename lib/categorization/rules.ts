import type { UserRule } from "@/lib/db/schema";
import type { IndustryConfig } from "@/lib/industries/types";
import {
  DENTAL_SUPPLY_VENDORS,
  DENTAL_LAB_VENDORS,
  DENTAL_LAB_PATTERNS,
  PRACTICE_SOFTWARE,
  PAYROLL_PROCESSORS,
  PERSONAL_SUBSCRIPTIONS,
  PERSONAL_PATTERNS,
  AMBIGUOUS_RETAIL,
} from "./vendors";
import { categorizeByAccount, categorizeByAccountWithConfig } from "./account-mapping";

export interface RuleResult {
  category: "business" | "personal" | "ambiguous";
  confidence: number;
  ruleId: string | null;
  reasoning: string;
}

interface TransactionInput {
  vendorName: string | null;
  description: string | null;
  amount: string;
  accountRef: string | null;
}

/** Check if vendor name matches any entry in a list (case-insensitive partial match) */
function matchesVendor(vendorName: string, list: string[]): string | null {
  const lower = vendorName.toLowerCase();
  return list.find((v) => lower.includes(v.toLowerCase())) || null;
}

/** Check if vendor matches any pattern */
function matchesPattern(vendorName: string, patterns: string[]): string | null {
  const lower = vendorName.toLowerCase();
  return patterns.find((p) => lower.includes(p.toLowerCase())) || null;
}

/**
 * Run Tier 1 deterministic rules against a transaction.
 * Rules are evaluated in priority order — first match wins.
 * When an IndustryConfig is provided, uses config-based vendor/pattern matching.
 * Without a config, falls back to hardcoded dental vendors for backward compatibility.
 */
export function categorizeTransaction(
  txn: TransactionInput,
  userRules: UserRule[] = [],
  config?: IndustryConfig
): RuleResult | null {
  const vendor = txn.vendorName || "";
  const desc = txn.description || "";
  const combined = `${vendor} ${desc}`.toLowerCase();

  // Priority 1: User-defined rules (highest priority)
  for (const rule of userRules) {
    const matchValue = rule.matchValue.toLowerCase();
    let matched = false;

    switch (rule.matchType) {
      case "vendor":
        matched = vendor.toLowerCase().includes(matchValue);
        break;
      case "description":
        matched = desc.toLowerCase().includes(matchValue);
        break;
      case "amount_range": {
        const [min, max] = matchValue.split("-").map(Number);
        const amt = Math.abs(parseFloat(txn.amount));
        matched = amt >= min && amt <= max;
        break;
      }
    }

    if (matched) {
      return {
        category: rule.category,
        confidence: 100,
        ruleId: rule.id,
        reasoning: `User rule: ${rule.matchType} matches "${rule.matchValue}"`,
      };
    }
  }

  // Priority 2: QBO account mapping — business/personal (bookkeeper's intent)
  const accountResult = config
    ? categorizeByAccountWithConfig(txn.accountRef, config)
    : categorizeByAccount(txn.accountRef);
  if (accountResult && accountResult.category !== "ambiguous") {
    return {
      category: accountResult.category,
      confidence: accountResult.confidence,
      ruleId: null,
      reasoning: accountResult.reasoning,
    };
  }

  // Use industry config if available, otherwise use hardcoded dental lists
  if (config) {
    return categorizeWithConfig(vendor, combined, accountResult, config);
  }

  return categorizeWithLegacy(vendor, combined, accountResult);
}

/** Config-based categorization using IndustryConfig vendor/pattern lists */
function categorizeWithConfig(
  vendor: string,
  combined: string,
  accountResult: { category: "business" | "personal" | "ambiguous"; confidence: number; reasoning: string } | null,
  config: IndustryConfig
): RuleResult | null {
  // Priority 3: Ambiguous vendors — always flag
  if (matchesVendor(vendor, config.vendors.ambiguous)) {
    return {
      category: "ambiguous",
      confidence: 40,
      ruleId: null,
      reasoning: `Ambiguous retail vendor: ${vendor} — requires manual review`,
    };
  }

  // Priority 4: Business vendors (100% confidence)
  const businessMatch = matchesVendor(vendor, config.vendors.business);
  if (businessMatch) {
    return {
      category: "business",
      confidence: 100,
      ruleId: null,
      reasoning: `Known business vendor: ${businessMatch}`,
    };
  }

  // Priority 5: Business pattern match (95% confidence)
  const businessPatterns = config.vendors.patterns.filter(
    (p) => !["gym", "fitness", "meal kit", "streaming"].includes(p.toLowerCase())
  );
  const bizPattern = matchesPattern(combined, businessPatterns);
  if (bizPattern) {
    return {
      category: "business",
      confidence: 95,
      ruleId: null,
      reasoning: `Vendor matches business pattern: "${bizPattern}"`,
    };
  }

  // Priority 6: Personal vendors (95% confidence)
  const personalMatch = matchesVendor(vendor, config.vendors.personal);
  if (personalMatch) {
    return {
      category: "personal",
      confidence: 95,
      ruleId: null,
      reasoning: `Known personal vendor: ${personalMatch}`,
    };
  }

  // Priority 7: Personal patterns (85% confidence)
  const personalPatterns = config.vendors.patterns.filter(
    (p) => ["gym", "fitness", "meal kit", "streaming"].includes(p.toLowerCase())
  );
  const persPattern = matchesPattern(combined, personalPatterns);
  if (persPattern) {
    return {
      category: "personal",
      confidence: 85,
      ruleId: null,
      reasoning: `Matches personal pattern: "${persPattern}"`,
    };
  }

  // Priority 8: QBO ambiguous account mapping — catch-all before giving up
  if (accountResult && accountResult.category === "ambiguous") {
    return {
      category: accountResult.category,
      confidence: accountResult.confidence,
      ruleId: null,
      reasoning: accountResult.reasoning,
    };
  }

  return null;
}

/** Legacy categorization using hardcoded dental vendor lists */
function categorizeWithLegacy(
  vendor: string,
  combined: string,
  accountResult: { category: "business" | "personal" | "ambiguous"; confidence: number; reasoning: string } | null
): RuleResult | null {
  // Priority 3: Ambiguous retail — always flag (check before other matches)
  if (matchesVendor(vendor, AMBIGUOUS_RETAIL)) {
    return {
      category: "ambiguous",
      confidence: 40,
      ruleId: null,
      reasoning: `Ambiguous retail vendor: ${vendor} — requires manual review`,
    };
  }

  // Priority 3: Dental supply vendors (100% confidence)
  const dentalMatch = matchesVendor(vendor, DENTAL_SUPPLY_VENDORS);
  if (dentalMatch) {
    return {
      category: "business",
      confidence: 100,
      ruleId: null,
      reasoning: `Known dental supply vendor: ${dentalMatch}`,
    };
  }

  // Priority 4: Dental lab vendors (100% confidence)
  const labMatch = matchesVendor(vendor, DENTAL_LAB_VENDORS);
  if (labMatch) {
    return {
      category: "business",
      confidence: 100,
      ruleId: null,
      reasoning: `Known dental lab: ${labMatch}`,
    };
  }

  // Priority 5: Dental lab pattern match (95% confidence)
  const labPattern = matchesPattern(combined, DENTAL_LAB_PATTERNS);
  if (labPattern) {
    return {
      category: "business",
      confidence: 95,
      ruleId: null,
      reasoning: `Vendor name contains dental lab pattern: "${labPattern}"`,
    };
  }

  // Priority 6: Practice software (100% confidence)
  const softwareMatch = matchesVendor(vendor, PRACTICE_SOFTWARE);
  if (softwareMatch) {
    return {
      category: "business",
      confidence: 100,
      ruleId: null,
      reasoning: `Known practice software: ${softwareMatch}`,
    };
  }

  // Priority 7: Payroll processors (100% confidence)
  const payrollMatch = matchesVendor(vendor, PAYROLL_PROCESSORS);
  if (payrollMatch) {
    return {
      category: "business",
      confidence: 100,
      ruleId: null,
      reasoning: `Known payroll processor: ${payrollMatch}`,
    };
  }

  // Priority 8: Personal subscriptions (95% confidence)
  const personalMatch = matchesVendor(vendor, PERSONAL_SUBSCRIPTIONS);
  if (personalMatch) {
    return {
      category: "personal",
      confidence: 95,
      ruleId: null,
      reasoning: `Known personal subscription: ${personalMatch}`,
    };
  }

  // Priority 9: Personal patterns (85% confidence)
  const personalPattern = matchesPattern(combined, PERSONAL_PATTERNS);
  if (personalPattern) {
    return {
      category: "personal",
      confidence: 85,
      ruleId: null,
      reasoning: `Matches personal pattern: "${personalPattern}"`,
    };
  }

  // Priority 11: QBO ambiguous account mapping — catch-all before giving up
  if (accountResult && accountResult.category === "ambiguous") {
    return {
      category: accountResult.category,
      confidence: accountResult.confidence,
      ruleId: null,
      reasoning: accountResult.reasoning,
    };
  }

  // No rule matched — transaction stays uncategorized
  return null;
}
