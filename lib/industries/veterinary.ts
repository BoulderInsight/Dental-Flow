import type { IndustryConfig } from "./types";

export const veterinaryConfig: IndustryConfig = {
  slug: "veterinary",
  name: "Veterinary Clinic",
  vendors: {
    business: [
      // Veterinary-specific vendors
      "Covetrus",
      "Henry Schein Animal Health",
      "Idexx",
      "VetSource",
      "Patterson Veterinary",
      "MWI Animal Health",
      "Heska",
      "Zoetis",
      "Elanco",
      "Merck Animal Health",
      "Dechra Veterinary Products",
      "VetCove",
      "Wedgewood Pharmacy",
      "Abaxis",
      "Sound Veterinary Equipment",
      "VetEquip",
      "Antech Diagnostics",
      // Practice management
      "Cornerstone",
      "AVImark",
      "eVetPractice",
      "Vetter Software",
      "Shepherd Veterinary Software",
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
      "veterinary supply",
      "vet supply",
      "animal health",
      "pet pharmacy",
      "boarding",
      "kennel",
      "gym",
      "fitness",
      "meal kit",
      "streaming",
    ],
  },
  seasonality: [
    0.92, // Jan - post-holiday dip
    0.90, // Feb - winter low
    1.02, // Mar - spring pickup
    1.08, // Apr - spring tick/flea season begins
    1.10, // May - peak tick/flea + allergy season
    1.05, // Jun - summer emergencies start
    1.08, // Jul - summer emergency spike
    1.05, // Aug
    0.98, // Sep
    0.95, // Oct
    0.92, // Nov
    0.95, // Dec - holiday boarding
  ],
  benchmarks: {
    overheadRatio: {
      healthy: 0.60,
      target: [0.60, 0.70],
      elevated: 0.78,
      critical: 0.78,
    },
  },
  accountMappings: {
    business: [
      "veterinary supplies",
      "medical supplies",
      "pharmaceuticals",
      "lab fees",
      "diagnostics",
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
      "boarding supplies",
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
};
