import type { IndustryConfig } from "./types";

export const chiropracticConfig: IndustryConfig = {
  slug: "chiropractic",
  name: "Chiropractic Office",
  vendors: {
    business: [
      // Chiropractic-specific vendors
      "ChiroTouch",
      "Palmer Supply",
      "The Joint",
      "SpineMD",
      "Chiromatrix",
      "Eclipse Practice Management",
      "ChiroFusion",
      "JTECH Medical",
      "Hill Laboratories",
      "Chattanooga Medical Supply",
      "Dynatronics",
      "Performance Health",
      "Biofreeze",
      "Foot Levelers",
      "Standard Process",
      "Activator Methods",
      "Ergo-Flex Technologies",
      // General practice vendors
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
      "chiropractic supply",
      "chiro supply",
      "spinal",
      "adjustment table",
      "gym",
      "fitness",
      "meal kit",
      "streaming",
    ],
  },
  seasonality: [
    1.08, // Jan - New Year resolutions, benefit reset
    1.02, // Feb
    1.0,  // Mar
    0.98, // Apr
    0.97, // May
    0.92, // Jun - summer dip
    0.88, // Jul - summer low
    0.90, // Aug
    0.98, // Sep - back to routine
    1.02, // Oct
    1.05, // Nov - holiday stress
    1.02, // Dec - slight dip for holidays
  ],
  benchmarks: {
    overheadRatio: {
      healthy: 0.50,
      target: [0.50, 0.60],
      elevated: 0.70,
      critical: 0.70,
    },
  },
  accountMappings: {
    business: [
      "chiropractic supplies",
      "treatment supplies",
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
      "medical supplies",
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
    revenueMultiple: { low: 0.50, mid: 0.60, high: 0.70 },
    ebitdaMultiple: { low: 3.0, mid: 4.0, high: 5.0 },
    sdeMultiple: { low: 1.5, mid: 2.0, high: 2.5 },
  },
  taxDefaults: {
    section179Limit: 1220000,
    bonusDepreciationRate: 0.4,
    estimatedTaxQuarters: ["04-15", "06-15", "09-15", "01-15"],
  },
};
