import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  practices,
  transactions,
  users,
  retirementProfiles,
  retirementMilestones,
  referralPartners,
  referralOpportunities,
  notificationPreferences,
} from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

// Dental seasonality multipliers (applied to revenue)
const SEASONALITY: Record<number, number> = {
  1: 1.05, // Jan - benefit reset
  2: 1.0,
  3: 1.02,
  4: 1.0,
  5: 0.98,
  6: 0.9, // Jun - summer dip
  7: 0.85, // Jul - summer low
  8: 0.88,
  9: 0.95,
  10: 0.98,
  11: 1.08, // Nov - year-end rush
  12: 1.12, // Dec - insurance rush
};

function vary(base: number, pct: number = 10): number {
  const factor = 1 + (Math.random() * 2 - 1) * (pct / 100);
  return Math.round(base * factor * 100) / 100;
}

interface SeedTxn {
  vendorName: string;
  description: string;
  amount: string;
  accountRef: string;
}

// Monthly recurring revenue templates (base amounts before seasonality)
function generateMonthlyRevenue(month: number): SeedTxn[] {
  const s = SEASONALITY[month] || 1.0;
  return [
    {
      vendorName: "Square Payment Processing",
      description: "Patient collections - credit card",
      amount: String(vary(45000 * s)),
      accountRef: "Patient Collections",
    },
    {
      vendorName: "Delta Dental Insurance",
      description: "Insurance reimbursements",
      amount: String(vary(22000 * s)),
      accountRef: "Insurance Reimbursements",
    },
    {
      vendorName: "Aetna Dental",
      description: "Insurance reimbursements",
      amount: String(vary(8500 * s)),
      accountRef: "Insurance Reimbursements",
    },
    {
      vendorName: "CareCredit",
      description: "Patient financing revenue",
      amount: String(vary(3500 * s, 20)),
      accountRef: "Financing Revenue",
    },
    {
      vendorName: "Cash/Check Deposits",
      description: "Patient cash and check payments",
      amount: String(vary(12000 * s, 15)),
      accountRef: "Patient Collections",
    },
  ];
}

// Monthly recurring expenses templates
function generateMonthlyExpenses(): SeedTxn[] {
  return [
    // Payroll (largest expense)
    { vendorName: "ADP", description: "Payroll processing - biweekly", amount: String(-vary(12500)), accountRef: "Payroll" },
    { vendorName: "ADP", description: "Payroll processing - biweekly", amount: String(-vary(12500)), accountRef: "Payroll" },
    // Rent
    { vendorName: "ABC Property Management", description: "Office rent - 123 Main St", amount: "-4500.00", accountRef: "Rent" },
    // Owner's Draw
    { vendorName: "Owner's Draw", description: "Monthly owner distribution", amount: "-15000.00", accountRef: "Owner's Draw" },
    // Loan payments
    { vendorName: "Wells Fargo", description: "Practice acquisition loan payment", amount: "-3200.00", accountRef: "Practice Loan" },
    { vendorName: "Bank of America", description: "Equipment loan - CEREC", amount: "-850.00", accountRef: "Equipment Loan" },
    // Insurance
    { vendorName: "State Farm Insurance", description: "Professional liability", amount: String(-vary(890)), accountRef: "Insurance" },
    { vendorName: "Hartford Insurance", description: "Business property insurance", amount: String(-vary(445)), accountRef: "Insurance" },
    // Utilities
    { vendorName: "Pacific Gas & Electric", description: "Monthly electric bill", amount: String(-vary(460, 15)), accountRef: "Utilities" },
    { vendorName: "City Water District", description: "Water and sewer", amount: String(-vary(125)), accountRef: "Utilities" },
    { vendorName: "AT&T Business", description: "Phone and internet", amount: "-289.00", accountRef: "Utilities" },
    // Software
    { vendorName: "Dentrix", description: "Monthly subscription", amount: "-499.00", accountRef: "Software" },
    { vendorName: "Weave", description: "Patient communication platform", amount: "-349.00", accountRef: "Software" },
    { vendorName: "Pearl", description: "AI second opinion monthly", amount: "-299.00", accountRef: "Software" },
    // Services
    { vendorName: "Waste Management", description: "Medical waste disposal", amount: "-175.00", accountRef: "Services" },
    { vendorName: "Cintas", description: "Uniform service monthly", amount: "-234.00", accountRef: "Services" },
    // Marketing
    { vendorName: "Yelp Business", description: "Advertising monthly", amount: "-350.00", accountRef: "Marketing" },
  ];
}

// Variable expenses that change month to month
function generateVariableExpenses(month: number): SeedTxn[] {
  const txns: SeedTxn[] = [];

  // Dental supplies (varies by patient volume)
  const s = SEASONALITY[month] || 1.0;
  txns.push(
    { vendorName: "Henry Schein", description: "Dental supplies - composite resin", amount: String(-vary(1250 * s)), accountRef: "Supplies" },
    { vendorName: "Henry Schein", description: "Prophy paste and disposables", amount: String(-vary(400 * s)), accountRef: "Supplies" },
    { vendorName: "Patterson Dental", description: "Dental instruments", amount: String(-vary(900 * s, 20)), accountRef: "Supplies" },
    { vendorName: "Benco Dental", description: "Nitrous oxide and impression materials", amount: String(-vary(500 * s)), accountRef: "Supplies" },
    { vendorName: "3M Dental", description: "Filtek composite and materials", amount: String(-vary(680 * s)), accountRef: "Supplies" },
  );

  // Lab fees (correlate with patient volume)
  txns.push(
    { vendorName: "Glidewell Dental Lab", description: "Crowns and bridges", amount: String(-vary(2100 * s, 25)), accountRef: "Lab Fees" },
    { vendorName: "Burbank Dental Lab", description: "Veneers and dentures", amount: String(-vary(1200 * s, 25)), accountRef: "Lab Fees" },
  );

  // Some months have CE/professional dues
  if (month === 1 || month === 7) {
    txns.push(
      { vendorName: "ADA", description: "Annual membership dues", amount: "-580.00", accountRef: "Professional" },
      { vendorName: "CDA", description: "State dental association dues", amount: "-350.00", accountRef: "Professional" },
    );
  }
  if (month === 3 || month === 9) {
    txns.push(
      { vendorName: "Spear Education", description: "CE online course", amount: String(-vary(300, 30)), accountRef: "Education" },
    );
  }

  // Phase 5: Retirement contributions (monthly SEP-IRA)
  txns.push(
    { vendorName: "Vanguard", description: "SEP-IRA contribution", amount: "-4500.00", accountRef: "Retirement Contribution" },
  );

  // Phase 5: Equipment purchases (occasional big-ticket items to trigger depreciation alerts)
  if (month === 2) {
    txns.push(
      { vendorName: "Dentsply Sirona", description: "CEREC Primescan AC unit", amount: "-45000.00", accountRef: "Equipment" },
    );
  }
  if (month === 6) {
    txns.push(
      { vendorName: "A-dec", description: "A-dec 500 dental chair", amount: "-18500.00", accountRef: "Equipment" },
    );
  }
  if (month === 10) {
    txns.push(
      { vendorName: "Planmeca", description: "ProMax 3D CBCT scanner", amount: "-85000.00", accountRef: "Equipment" },
    );
  }

  // Phase 5: Additional loan pattern (SBA line of credit)
  txns.push(
    { vendorName: "Chase Bank", description: "SBA line of credit payment", amount: "-650.00", accountRef: "Line of Credit" },
  );

  // Personal expenses (owner's personal charges through business account)
  txns.push(
    { vendorName: "Netflix", description: "Monthly subscription", amount: "-22.99", accountRef: "Entertainment" },
    { vendorName: "Spotify", description: "Family plan", amount: "-16.99", accountRef: "Entertainment" },
    { vendorName: "Equinox", description: "Monthly membership", amount: "-185.00", accountRef: "Fitness" },
    { vendorName: "HelloFresh", description: "Weekly meal kit", amount: String(-vary(90)), accountRef: "Food" },
  );

  // Ambiguous purchases (1-3 per month)
  const ambiguousCount = 1 + Math.floor(Math.random() * 3);
  const ambiguousOptions: SeedTxn[] = [
    { vendorName: "Amazon.com", description: "Office supplies", amount: String(-vary(160, 40)), accountRef: "Supplies" },
    { vendorName: "Amazon.com", description: "Order #114-2345678", amount: String(-vary(90, 50)), accountRef: "Supplies" },
    { vendorName: "Costco", description: "Warehouse purchase", amount: String(-vary(350, 30)), accountRef: "Supplies" },
    { vendorName: "Target", description: "Store purchase", amount: String(-vary(100, 40)), accountRef: "Supplies" },
    { vendorName: "Walmart", description: "Cleaning supplies", amount: String(-vary(70, 30)), accountRef: "Supplies" },
    { vendorName: "Staples", description: "Printer toner and paper", amount: String(-vary(200, 30)), accountRef: "Office" },
    { vendorName: "Best Buy", description: "Electronics purchase", amount: String(-vary(400, 50)), accountRef: "Equipment" },
  ];
  for (let i = 0; i < ambiguousCount; i++) {
    txns.push(ambiguousOptions[Math.floor(Math.random() * ambiguousOptions.length)]);
  }

  return txns;
}

async function seed() {
  console.log("Seeding database...");

  // Create test practice
  const [practice] = await db
    .insert(practices)
    .values({
      name: "Sunny Valley Dental",
      industry: "dental",
      qboRealmId: "demo-realm-123",
      fiscalYearStart: 1,
      practiceAddresses: ["123 Main St, Sunnyvale, CA 94086"],
      realEstateValue: "650000.00",
      estimatedValue: "1200000.00",
    })
    .returning();

  console.log(`Created practice: ${practice.name} (${practice.id})`);

  // Generate 18 months of transactions (enough for forecast + trends)
  const now = new Date();
  const allTxns: Array<{
    practiceId: string;
    qboTxnId: string;
    date: Date;
    amount: string;
    vendorName: string;
    description: string;
    accountRef: string;
    rawJson: Record<string, unknown>;
  }> = [];

  let txnCounter = 1;

  for (let monthsAgo = 17; monthsAgo >= 0; monthsAgo--) {
    const year = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1).getFullYear();
    const month = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1).getMonth() + 1;

    // Revenue transactions (spread across the month)
    const revenue = generateMonthlyRevenue(month);
    for (const txn of revenue) {
      const day = 1 + Math.floor(Math.random() * 28);
      allTxns.push({
        practiceId: practice.id,
        qboTxnId: `demo-txn-${String(txnCounter++).padStart(5, "0")}`,
        date: new Date(year, month - 1, day),
        amount: txn.amount,
        vendorName: txn.vendorName,
        description: txn.description,
        accountRef: txn.accountRef,
        rawJson: { seed: true, vendorName: txn.vendorName },
      });
    }

    // Recurring expenses
    const recurring = generateMonthlyExpenses();
    for (const txn of recurring) {
      const day = txn.vendorName === "ADP" ? (txnCounter % 2 === 0 ? 15 : 1) : 1 + Math.floor(Math.random() * 28);
      allTxns.push({
        practiceId: practice.id,
        qboTxnId: `demo-txn-${String(txnCounter++).padStart(5, "0")}`,
        date: new Date(year, month - 1, Math.min(day, 28)),
        amount: txn.amount,
        vendorName: txn.vendorName,
        description: txn.description,
        accountRef: txn.accountRef,
        rawJson: { seed: true, vendorName: txn.vendorName },
      });
    }

    // Variable expenses
    const variable = generateVariableExpenses(month);
    for (const txn of variable) {
      const day = 1 + Math.floor(Math.random() * 28);
      allTxns.push({
        practiceId: practice.id,
        qboTxnId: `demo-txn-${String(txnCounter++).padStart(5, "0")}`,
        date: new Date(year, month - 1, day),
        amount: txn.amount,
        vendorName: txn.vendorName,
        description: txn.description,
        accountRef: txn.accountRef,
        rawJson: { seed: true, vendorName: txn.vendorName },
      });
    }
  }

  // Insert in batches to avoid query size limits
  const BATCH_SIZE = 100;
  for (let i = 0; i < allTxns.length; i += BATCH_SIZE) {
    const batch = allTxns.slice(i, i + BATCH_SIZE);
    await db.insert(transactions).values(batch);
  }

  console.log(`Inserted ${allTxns.length} transactions across 18 months`);
  console.log("Income transactions included: Patient Collections, Insurance Reimbursements, Financing Revenue");
  console.log("Owner's Draw: $15,000/mo");
  console.log("Loan payments: Practice Loan $3,200/mo + Equipment Loan $850/mo + SBA LOC $650/mo");
  console.log("Retirement: SEP-IRA $4,500/mo");
  console.log("Equipment purchases: CEREC $45K (Feb), Dental Chair $18.5K (Jun), CBCT $85K (Oct)");
  console.log("Practice real estate value: $650K (triggers cost segregation alert)");

  // ── Phase 6: Retirement profile + milestones ─────────────────────────────

  const [retProfile] = await db
    .insert(retirementProfiles)
    .values({
      practiceId: practice.id,
      currentAge: 42,
      targetRetirementAge: 60,
      desiredMonthlyIncome: "15000.00",
      socialSecurityEstimate: "2500.00",
      otherPensionIncome: "0.00",
      riskTolerance: "moderate",
      inflationRate: "0.03",
      expectedReturnRate: "0.07",
    })
    .returning();

  console.log(`Created retirement profile (age ${retProfile.currentAge}, target ${retProfile.targetRetirementAge})`);

  const oneYearOut = new Date();
  oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
  const twoYearsOut = new Date();
  twoYearsOut.setFullYear(twoYearsOut.getFullYear() + 2);
  const threeYearsOut = new Date();
  threeYearsOut.setFullYear(threeYearsOut.getFullYear() + 3);
  const retirementDate = new Date();
  retirementDate.setFullYear(retirementDate.getFullYear() + (60 - 42));

  await db.insert(retirementMilestones).values([
    {
      practiceId: practice.id,
      title: "Max Out SEP-IRA Contributions",
      targetDate: oneYearOut.toISOString().split("T")[0],
      category: "contribution",
      status: "planned",
      notes: "Increase annual SEP-IRA contributions to the $69K federal limit.",
    },
    {
      practiceId: practice.id,
      title: "Purchase Rental Property #1",
      targetDate: twoYearsOut.toISOString().split("T")[0],
      estimatedCost: "350000.00",
      estimatedMonthlyIncome: "2500.00",
      category: "real_estate",
      status: "planned",
      notes: "Target a duplex or small multi-family near the practice area.",
    },
    {
      practiceId: practice.id,
      title: "Pay Off Practice Acquisition Loan",
      targetDate: threeYearsOut.toISOString().split("T")[0],
      category: "debt_payoff",
      status: "in_progress",
      notes: "Accelerate payments on the Wells Fargo practice acquisition loan.",
    },
    {
      practiceId: practice.id,
      title: "Sell Practice",
      targetDate: retirementDate.toISOString().split("T")[0],
      category: "practice_sale",
      status: "planned",
      notes: "Plan for practice transition — associate buy-in or outright sale.",
    },
  ]);

  console.log("Created 4 retirement milestones");

  // ── Phase 6: Referral partners ───────────────────────────────────────────

  const partnerValues = [
    {
      name: "Pacific Dental Lending",
      category: "lender",
      description: "Specialized dental practice financing with competitive SBA rates.",
      contactEmail: "loans@pacificdentallending.com",
      website: "https://pacificdentallending.com",
      regions: ["CA", "OR", "WA"],
      industries: ["dental"],
      isActive: true,
    },
    {
      name: "MedPro Group Insurance",
      category: "insurance",
      description: "Professional liability and property insurance for healthcare practices.",
      contactEmail: "quotes@medprogroup.com",
      website: "https://medprogroup.com",
      regions: ["US"],
      industries: ["dental", "chiropractic", "veterinary"],
      isActive: true,
    },
    {
      name: "DentalCPA Partners",
      category: "cpa",
      description: "CPA firm specializing in dental practice accounting and tax optimization.",
      contactEmail: "info@dentalcpa.com",
      website: "https://dentalcpa.com",
      regions: ["US"],
      industries: ["dental"],
      isActive: true,
    },
    {
      name: "Pinnacle Wealth Advisors",
      category: "financial_advisor",
      description: "Financial planning and wealth management for healthcare professionals.",
      contactEmail: "plan@pinnaclewealth.com",
      website: "https://pinnaclewealth.com",
      regions: ["US"],
      industries: ["dental", "chiropractic", "veterinary"],
      isActive: true,
    },
    {
      name: "PracticeMatch Brokers",
      category: "broker",
      description: "Practice sales and acquisitions brokerage for dental professionals.",
      contactEmail: "deals@practicematch.com",
      website: "https://practicematch.com",
      regions: ["CA", "TX", "FL", "NY"],
      industries: ["dental"],
      isActive: true,
    },
    {
      name: "Dental Equipment Finance Co",
      category: "equipment_financing",
      description: "Equipment leasing and financing with $0-down options for dental technology.",
      contactEmail: "leasing@dentalequipfinance.com",
      website: "https://dentalequipfinance.com",
      regions: ["US"],
      industries: ["dental"],
      isActive: true,
    },
  ];

  const insertedPartners = await db
    .insert(referralPartners)
    .values(partnerValues)
    .returning();

  console.log(`Created ${insertedPartners.length} referral partners`);

  // ── Phase 6: Referral opportunities ──────────────────────────────────────

  const lenderPartner = insertedPartners.find((p) => p.category === "lender");
  const insurancePartner = insertedPartners.find((p) => p.category === "insurance");
  const cpaPartner = insertedPartners.find((p) => p.category === "cpa");

  await db.insert(referralOpportunities).values([
    {
      practiceId: practice.id,
      opportunityType: "refinance",
      title: "Practice Loan Refinance Opportunity",
      description:
        "Your current practice loan rate appears above market. Refinancing could save an estimated $4,800/year.",
      estimatedSavings: "4800.00",
      priority: "high",
      status: "detected",
      matchedPartnerId: lenderPartner?.id,
      expiresAt: new Date(now.getFullYear(), now.getMonth() + 3, 0),
    },
    {
      practiceId: practice.id,
      opportunityType: "insurance",
      title: "Professional Liability Insurance Review",
      description:
        "Your liability premiums may be reducible. A competitive quote could save $1,200/year.",
      estimatedSavings: "1200.00",
      priority: "medium",
      status: "detected",
      matchedPartnerId: insurancePartner?.id,
      expiresAt: new Date(now.getFullYear(), now.getMonth() + 6, 0),
    },
    {
      practiceId: practice.id,
      opportunityType: "tax_planning",
      title: "Tax Strategy Review with Dental CPA",
      description:
        "Based on your revenue and entity structure, a specialized dental CPA could identify $8,000+ in annual tax savings.",
      estimatedSavings: "8000.00",
      priority: "high",
      status: "detected",
      matchedPartnerId: cpaPartner?.id,
      expiresAt: new Date(now.getFullYear() + 1, 0, 31),
    },
  ]);

  console.log("Created 3 detected referral opportunities");

  // ── Phase 6: Notification preferences for demo user ──────────────────────

  // Check if a demo user exists; if not, create one for notification prefs
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .limit(1);

  if (existingUser) {
    await db.insert(notificationPreferences).values({
      userId: existingUser.id,
      emailInvites: true,
      emailTaxAlerts: true,
      emailMonthlyDigest: true,
      emailReferralOpportunities: true,
      emailWeeklyInsights: false,
    });
    console.log("Created notification preferences for existing user");
  } else {
    console.log("No user found — skipping notification preferences (demo mode uses session mock)");
  }

  console.log("Phase 6 seed data complete!");
  console.log("Seed complete!");

  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
