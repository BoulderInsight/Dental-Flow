import type { IndustryConfig } from "./types";

export const generalConfig: IndustryConfig = {
  slug: "general",
  name: "General Small Business",
  vendors: {
    business: [
      // Payroll processors (common to all)
      "ADP",
      "Gusto",
      "Paychex",
      "QuickBooks Payroll",
      "Intuit Payroll",
    ],
    personal: [
      "Netflix",
      "Spotify",
      "Hulu",
      "Disney+",
      "HBO Max",
      "Apple TV",
      "Amazon Prime Video",
      "YouTube Premium",
      "Peacock",
      "Paramount+",
      "Peloton",
      "DoorDash",
      "Uber Eats",
      "Grubhub",
      "Postmates",
      "HelloFresh",
      "Blue Apron",
      "Starbucks",
    ],
    ambiguous: [
      "Amazon",
      "Walmart",
      "Target",
      "Costco",
      "Sam's Club",
      "Staples",
      "Office Depot",
      "Best Buy",
      "Apple Store",
    ],
    patterns: [
      "gym",
      "fitness",
      "meal kit",
      "streaming",
    ],
  },
  seasonality: [
    1.0, // Jan
    1.0, // Feb
    1.0, // Mar
    1.0, // Apr
    1.0, // May
    1.0, // Jun
    1.0, // Jul
    1.0, // Aug
    1.0, // Sep
    1.0, // Oct
    1.0, // Nov
    1.0, // Dec
  ],
  benchmarks: {
    overheadRatio: {
      healthy: 0.55,
      target: [0.55, 0.65],
      elevated: 0.75,
      critical: 0.75,
    },
  },
  accountMappings: {
    business: [
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
      "services",
      "uniforms",
      "software",
    ],
    personal: [
      "entertainment",
      "fitness",
      "personal",
      "owner's draw",
      "owner's personal",
      "personal expenses",
    ],
    ambiguous: [
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
    ],
  },
  debtServicePatterns: [
    "loan payment",
    "note payable",
    "loan interest",
    "equipment loan",
    "practice loan",
    "mortgage",
    "line of credit",
  ],
  ownerDrawPatterns: [
    "owner's draw",
    "owner's personal",
    "distributions",
    "owner salary",
    "owner draw",
  ],
  valuationMultipliers: {
    revenueMultiple: { low: 0.40, mid: 0.60, high: 0.80 },
    ebitdaMultiple: { low: 3.0, mid: 4.0, high: 5.0 },
    sdeMultiple: { low: 1.5, mid: 2.25, high: 3.0 },
  },
  taxDefaults: {
    section179Limit: 1220000,
    bonusDepreciationRate: 0.4,
    estimatedTaxQuarters: ["04-15", "06-15", "09-15", "01-15"],
  },
};
