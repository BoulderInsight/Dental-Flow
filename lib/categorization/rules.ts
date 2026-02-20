import type { UserRule } from "@/lib/db/schema";
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
 */
export function categorizeTransaction(
  txn: TransactionInput,
  userRules: UserRule[] = []
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

  // Priority 2: Ambiguous retail — always flag (check before other matches)
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

  // No rule matched — transaction stays uncategorized
  return null;
}
