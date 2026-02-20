// Known vendor lists for Tier 1 deterministic categorization.
// Add new vendors as single-line entries — first match wins.

export const DENTAL_SUPPLY_VENDORS = [
  "Henry Schein",
  "Patterson Dental",
  "Benco Dental",
  "Darby Dental",
  "Net32",
  "Ultradent",
  "Dentsply Sirona",
  "Dentsply",
  "3M Dental",
  "3M ESPE",
  "Hu-Friedy",
  "Ivoclar Vivadent",
  "Kerr Dental",
  "Septodont",
  "Crosstex",
  "Young Dental",
  "Brasseler",
  "Midwest Dental",
  "Miltex",
  "Coltene",
  "GC America",
  "Shofu Dental",
  "Premier Dental",
  "Orascoptic",
  "SciCan",
  "A-dec",
  "Pelton & Crane",
];

export const DENTAL_LAB_VENDORS = [
  "Glidewell",
  "Burbank Dental Lab",
  "Artistic Dental Lab",
  "Bay Area Dental Lab",
  "Pacific Dental Lab",
];

/** Pattern matches: any vendor containing these strings (case-insensitive) */
export const DENTAL_LAB_PATTERNS = ["dental lab", "dental laboratory"];

export const PRACTICE_SOFTWARE = [
  "Dentrix",
  "Eaglesoft",
  "Open Dental",
  "Pearl",
  "Weave",
  "Curve Dental",
  "Dentally",
  "Apteryx",
  "XrayVision",
  "Dexis",
  "Carestream Dental",
  "Planmeca",
  "iDentalSoft",
];

export const PAYROLL_PROCESSORS = [
  "ADP",
  "Gusto",
  "Paychex",
  "QuickBooks Payroll",
  "Intuit Payroll",
];

export const PERSONAL_SUBSCRIPTIONS = [
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
];

export const PERSONAL_PATTERNS = [
  "gym",
  "fitness",
  "meal kit",
  "streaming",
];

export const AMBIGUOUS_RETAIL = [
  "Amazon",
  "Walmart",
  "Target",
  "Costco",
  "Sam's Club",
  "Staples",
  "Office Depot",
  "Best Buy",
  "Apple Store",
];
