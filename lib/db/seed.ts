import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { practices, transactions } from "./schema";

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
      qboRealmId: "demo-realm-123",
      fiscalYearStart: 1,
      practiceAddresses: ["123 Main St, Sunnyvale, CA 94086"],
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
  console.log("Loan payments: Practice Loan $3,200/mo + Equipment Loan $850/mo");
  console.log("Seed complete!");

  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
