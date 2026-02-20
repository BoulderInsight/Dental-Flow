import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { practices, transactions } from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

// Seed data: ~100 transactions across dental supply, lab, software, payroll, personal, ambiguous, misc
const seedTransactions: {
  vendorName: string;
  description: string;
  amount: string;
  accountRef: string;
  category: "dental_supply" | "lab" | "software" | "payroll" | "personal" | "ambiguous" | "misc";
}[] = [
  // ~30 Dental supply vendors
  { vendorName: "Henry Schein", description: "Dental supplies - composite resin", amount: "-1245.50", accountRef: "Supplies", category: "dental_supply" },
  { vendorName: "Henry Schein", description: "Prophy paste and cups", amount: "-389.00", accountRef: "Supplies", category: "dental_supply" },
  { vendorName: "Henry Schein", description: "Disposable prophy angles", amount: "-210.75", accountRef: "Supplies", category: "dental_supply" },
  { vendorName: "Patterson Dental", description: "Dental instruments - scalers", amount: "-875.00", accountRef: "Supplies", category: "dental_supply" },
  { vendorName: "Patterson Dental", description: "X-ray film and sensors", amount: "-2340.00", accountRef: "Equipment", category: "dental_supply" },
  { vendorName: "Patterson Dental", description: "Sterilization pouches", amount: "-156.25", accountRef: "Supplies", category: "dental_supply" },
  { vendorName: "Benco Dental", description: "Nitrous oxide supplies", amount: "-445.00", accountRef: "Supplies", category: "dental_supply" },
  { vendorName: "Benco Dental", description: "Impression materials", amount: "-312.50", accountRef: "Supplies", category: "dental_supply" },
  { vendorName: "Benco Dental", description: "Disposable bibs and cups", amount: "-89.99", accountRef: "Supplies", category: "dental_supply" },
  { vendorName: "Darby Dental Supply", description: "Latex-free gloves case", amount: "-178.00", accountRef: "Supplies", category: "dental_supply" },
  { vendorName: "Darby Dental Supply", description: "Face masks N95", amount: "-245.00", accountRef: "Supplies", category: "dental_supply" },
  { vendorName: "Net32", description: "Cavitron tips and inserts", amount: "-198.50", accountRef: "Supplies", category: "dental_supply" },
  { vendorName: "Net32", description: "Bonding agent", amount: "-345.00", accountRef: "Supplies", category: "dental_supply" },
  { vendorName: "Net32", description: "Etchant gel", amount: "-67.50", accountRef: "Supplies", category: "dental_supply" },
  { vendorName: "Ultradent Products", description: "Whitening supplies", amount: "-567.00", accountRef: "Supplies", category: "dental_supply" },
  { vendorName: "Dentsply Sirona", description: "Endodontic files", amount: "-423.00", accountRef: "Supplies", category: "dental_supply" },
  { vendorName: "Dentsply Sirona", description: "Ceramic blocks for CEREC", amount: "-1890.00", accountRef: "Equipment", category: "dental_supply" },
  { vendorName: "3M Dental", description: "Filtek composite", amount: "-678.00", accountRef: "Supplies", category: "dental_supply" },
  { vendorName: "3M Dental", description: "Impregum impression material", amount: "-234.00", accountRef: "Supplies", category: "dental_supply" },
  { vendorName: "Hu-Friedy", description: "Gracey curettes set", amount: "-1120.00", accountRef: "Instruments", category: "dental_supply" },
  { vendorName: "Hu-Friedy", description: "Mirror handles", amount: "-85.00", accountRef: "Instruments", category: "dental_supply" },
  { vendorName: "Ivoclar Vivadent", description: "IPS e.max crowns", amount: "-945.00", accountRef: "Supplies", category: "dental_supply" },
  { vendorName: "Kerr Dental", description: "Temp-Bond cement", amount: "-112.00", accountRef: "Supplies", category: "dental_supply" },
  { vendorName: "Septodont", description: "Articaine cartridges", amount: "-289.00", accountRef: "Supplies", category: "dental_supply" },
  { vendorName: "Septodont", description: "Lidocaine cartridges", amount: "-195.00", accountRef: "Supplies", category: "dental_supply" },
  { vendorName: "Crosstex International", description: "Infection control products", amount: "-334.00", accountRef: "Supplies", category: "dental_supply" },
  { vendorName: "Young Dental", description: "Prophy cups and brushes", amount: "-145.00", accountRef: "Supplies", category: "dental_supply" },
  { vendorName: "Brasseler USA", description: "Diamond burs assorted", amount: "-567.00", accountRef: "Instruments", category: "dental_supply" },
  { vendorName: "Brasseler USA", description: "Carbide burs", amount: "-234.50", accountRef: "Instruments", category: "dental_supply" },
  { vendorName: "Midwest Dental", description: "Handpiece maintenance kit", amount: "-189.00", accountRef: "Equipment", category: "dental_supply" },

  // ~10 Lab fees
  { vendorName: "Glidewell Dental Lab", description: "PFM crowns x4", amount: "-1200.00", accountRef: "Lab Fees", category: "lab" },
  { vendorName: "Glidewell Dental Lab", description: "Zirconia crowns x6", amount: "-2100.00", accountRef: "Lab Fees", category: "lab" },
  { vendorName: "Glidewell Dental Lab", description: "Night guard", amount: "-175.00", accountRef: "Lab Fees", category: "lab" },
  { vendorName: "Burbank Dental Lab", description: "Porcelain veneers x8", amount: "-3200.00", accountRef: "Lab Fees", category: "lab" },
  { vendorName: "Burbank Dental Lab", description: "Denture repair", amount: "-250.00", accountRef: "Lab Fees", category: "lab" },
  { vendorName: "Burbank Dental Lab", description: "Full denture upper", amount: "-890.00", accountRef: "Lab Fees", category: "lab" },
  { vendorName: "Artistic Dental Lab", description: "Implant abutment custom", amount: "-450.00", accountRef: "Lab Fees", category: "lab" },
  { vendorName: "Artistic Dental Lab", description: "Partial denture framework", amount: "-675.00", accountRef: "Lab Fees", category: "lab" },
  { vendorName: "Bay Area Dental Lab", description: "Temporary crowns x3", amount: "-225.00", accountRef: "Lab Fees", category: "lab" },
  { vendorName: "Pacific Dental Lab Services", description: "Orthodontic retainers x2", amount: "-350.00", accountRef: "Lab Fees", category: "lab" },

  // ~10 Practice software
  { vendorName: "Dentrix", description: "Monthly subscription", amount: "-499.00", accountRef: "Software", category: "software" },
  { vendorName: "Dentrix", description: "Annual support renewal", amount: "-2400.00", accountRef: "Software", category: "software" },
  { vendorName: "Eaglesoft", description: "Monthly license", amount: "-399.00", accountRef: "Software", category: "software" },
  { vendorName: "Pearl", description: "AI second opinion monthly", amount: "-299.00", accountRef: "Software", category: "software" },
  { vendorName: "Weave", description: "Patient communication platform", amount: "-349.00", accountRef: "Software", category: "software" },
  { vendorName: "Weave", description: "Phone system add-on", amount: "-149.00", accountRef: "Software", category: "software" },
  { vendorName: "Curve Dental", description: "Cloud practice management", amount: "-450.00", accountRef: "Software", category: "software" },
  { vendorName: "Open Dental", description: "Support plan monthly", amount: "-169.00", accountRef: "Software", category: "software" },
  { vendorName: "Apteryx", description: "XrayVision imaging software", amount: "-129.00", accountRef: "Software", category: "software" },
  { vendorName: "Dentally", description: "Cloud PMS monthly", amount: "-275.00", accountRef: "Software", category: "software" },

  // ~8 Payroll
  { vendorName: "ADP", description: "Payroll processing - biweekly", amount: "-12500.00", accountRef: "Payroll", category: "payroll" },
  { vendorName: "ADP", description: "Payroll processing - biweekly", amount: "-12500.00", accountRef: "Payroll", category: "payroll" },
  { vendorName: "ADP", description: "Year-end tax filing service", amount: "-350.00", accountRef: "Payroll", category: "payroll" },
  { vendorName: "Gusto", description: "Payroll service monthly", amount: "-89.00", accountRef: "Payroll", category: "payroll" },
  { vendorName: "Gusto", description: "Benefits administration", amount: "-45.00", accountRef: "Payroll", category: "payroll" },
  { vendorName: "Gusto", description: "Workers comp premium", amount: "-234.00", accountRef: "Insurance", category: "payroll" },
  { vendorName: "Paychex", description: "Payroll processing", amount: "-11800.00", accountRef: "Payroll", category: "payroll" },
  { vendorName: "QuickBooks Payroll", description: "Payroll subscription", amount: "-75.00", accountRef: "Payroll", category: "payroll" },

  // ~12 Personal
  { vendorName: "Netflix", description: "Monthly subscription", amount: "-22.99", accountRef: "Entertainment", category: "personal" },
  { vendorName: "Spotify", description: "Family plan", amount: "-16.99", accountRef: "Entertainment", category: "personal" },
  { vendorName: "Planet Fitness", description: "Monthly membership", amount: "-24.99", accountRef: "Fitness", category: "personal" },
  { vendorName: "Equinox", description: "Monthly membership", amount: "-185.00", accountRef: "Fitness", category: "personal" },
  { vendorName: "HelloFresh", description: "Weekly meal kit", amount: "-89.99", accountRef: "Food", category: "personal" },
  { vendorName: "Blue Apron", description: "Meal delivery", amount: "-71.94", accountRef: "Food", category: "personal" },
  { vendorName: "Hulu", description: "Streaming monthly", amount: "-17.99", accountRef: "Entertainment", category: "personal" },
  { vendorName: "Disney+", description: "Annual subscription", amount: "-139.99", accountRef: "Entertainment", category: "personal" },
  { vendorName: "Peloton", description: "Monthly membership", amount: "-44.00", accountRef: "Fitness", category: "personal" },
  { vendorName: "Starbucks", description: "Auto-reload", amount: "-50.00", accountRef: "Food", category: "personal" },
  { vendorName: "Uber Eats", description: "Food delivery", amount: "-34.50", accountRef: "Food", category: "personal" },
  { vendorName: "DoorDash", description: "Food delivery", amount: "-42.75", accountRef: "Food", category: "personal" },

  // ~15 Ambiguous (Amazon, Walmart, Target, generic)
  { vendorName: "Amazon.com", description: "Office supplies", amount: "-156.78", accountRef: "Supplies", category: "ambiguous" },
  { vendorName: "Amazon.com", description: "Order #114-2345678", amount: "-89.99", accountRef: "Supplies", category: "ambiguous" },
  { vendorName: "Amazon.com", description: "Prime membership", amount: "-14.99", accountRef: "Subscriptions", category: "ambiguous" },
  { vendorName: "Amazon.com", description: "Kindle purchase", amount: "-12.99", accountRef: "Entertainment", category: "ambiguous" },
  { vendorName: "Walmart", description: "Store purchase", amount: "-234.56", accountRef: "Supplies", category: "ambiguous" },
  { vendorName: "Walmart", description: "Cleaning supplies", amount: "-67.89", accountRef: "Supplies", category: "ambiguous" },
  { vendorName: "Walmart", description: "Store purchase", amount: "-45.23", accountRef: "Supplies", category: "ambiguous" },
  { vendorName: "Target", description: "Store purchase", amount: "-123.45", accountRef: "Supplies", category: "ambiguous" },
  { vendorName: "Target", description: "Store purchase", amount: "-78.90", accountRef: "Supplies", category: "ambiguous" },
  { vendorName: "Costco", description: "Warehouse purchase", amount: "-456.78", accountRef: "Supplies", category: "ambiguous" },
  { vendorName: "Costco", description: "Paper products bulk", amount: "-189.99", accountRef: "Supplies", category: "ambiguous" },
  { vendorName: "Staples", description: "Printer toner", amount: "-234.00", accountRef: "Office", category: "ambiguous" },
  { vendorName: "Office Depot", description: "Paper and folders", amount: "-89.50", accountRef: "Office", category: "ambiguous" },
  { vendorName: "Best Buy", description: "Computer monitor", amount: "-549.99", accountRef: "Equipment", category: "ambiguous" },
  { vendorName: "Apple Store", description: "iPad purchase", amount: "-999.00", accountRef: "Equipment", category: "ambiguous" },

  // ~15 Misc (utilities, rent, insurance, CE courses)
  { vendorName: "Pacific Gas & Electric", description: "Monthly electric bill", amount: "-456.78", accountRef: "Utilities", category: "misc" },
  { vendorName: "City Water District", description: "Water and sewer", amount: "-123.45", accountRef: "Utilities", category: "misc" },
  { vendorName: "AT&T Business", description: "Phone and internet", amount: "-289.00", accountRef: "Utilities", category: "misc" },
  { vendorName: "Comcast Business", description: "Internet service", amount: "-199.00", accountRef: "Utilities", category: "misc" },
  { vendorName: "ABC Property Management", description: "Office rent - 123 Main St", amount: "-4500.00", accountRef: "Rent", category: "misc" },
  { vendorName: "ABC Property Management", description: "Office rent - 123 Main St", amount: "-4500.00", accountRef: "Rent", category: "misc" },
  { vendorName: "State Farm Insurance", description: "Professional liability", amount: "-890.00", accountRef: "Insurance", category: "misc" },
  { vendorName: "Hartford Insurance", description: "Business property insurance", amount: "-445.00", accountRef: "Insurance", category: "misc" },
  { vendorName: "ADA", description: "Annual membership dues", amount: "-580.00", accountRef: "Professional", category: "misc" },
  { vendorName: "CDA", description: "State dental association dues", amount: "-350.00", accountRef: "Professional", category: "misc" },
  { vendorName: "Spear Education", description: "CE online course", amount: "-299.00", accountRef: "Education", category: "misc" },
  { vendorName: "Dental Economics CE", description: "Continuing education seminar", amount: "-450.00", accountRef: "Education", category: "misc" },
  { vendorName: "Waste Management", description: "Medical waste disposal", amount: "-175.00", accountRef: "Services", category: "misc" },
  { vendorName: "Cintas", description: "Uniform service monthly", amount: "-234.00", accountRef: "Services", category: "misc" },
  { vendorName: "Yelp Business", description: "Advertising monthly", amount: "-350.00", accountRef: "Marketing", category: "misc" },
];

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

  // Generate transactions with dates spread over 12 months
  const now = new Date();
  const txnValues = seedTransactions.map((txn, i) => {
    // Spread dates over the past 12 months
    const monthsAgo = Math.floor((i / seedTransactions.length) * 12);
    const day = (i % 28) + 1;
    const date = new Date(now.getFullYear(), now.getMonth() - monthsAgo, day);

    return {
      practiceId: practice.id,
      qboTxnId: `demo-txn-${String(i + 1).padStart(4, "0")}`,
      date,
      amount: txn.amount,
      vendorName: txn.vendorName,
      description: txn.description,
      accountRef: txn.accountRef,
      rawJson: {
        seed: true,
        originalCategory: txn.category,
        vendorName: txn.vendorName,
        description: txn.description,
        amount: txn.amount,
      },
    };
  });

  await db.insert(transactions).values(txnValues);

  console.log(`Inserted ${txnValues.length} transactions`);
  console.log("Seed complete!");

  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
