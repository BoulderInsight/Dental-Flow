// ---------------------------------------------------------------------------
// ROI Calculator Engine
// Supports: Real Estate, Practice Acquisition, Equipment
// ---------------------------------------------------------------------------

const DISCLAIMER =
  "This is not financial advice. Consult your CPA/financial advisor before making investment decisions.";

// ---------------------------------------------------------------------------
// Input Types
// ---------------------------------------------------------------------------

export interface RealEstateROIInputs {
  purchasePrice: number;
  downPayment: number;
  loanRate: number; // annual rate as decimal, e.g. 0.065 = 6.5%
  loanTermYears: number;
  closingCosts: number;
  monthlyRentalIncome: number;
  monthlyExpenses: number; // taxes, insurance, management, maintenance
  vacancyRate: number; // as decimal, e.g. 0.05 = 5%
  annualAppreciation: number; // as decimal, e.g. 0.03 = 3%
  holdPeriodYears: number;
}

export interface PracticeAcquisitionROIInputs {
  purchasePrice: number;
  downPayment: number;
  loanRate: number; // annual rate as decimal
  loanTermYears: number;
  currentAnnualRevenue: number;
  projectedGrowthRate: number; // annual, as decimal
  operatingExpenseRatio: number; // as decimal, e.g. 0.60 = 60%
  additionalStaffCost: number; // annual
}

export interface EquipmentROIInputs {
  cost: number;
  expectedRevenueIncrease: number; // annual
  usefulLifeYears: number;
  maintenanceCostAnnual: number;
  financingRate?: number; // annual rate as decimal
  financingTermMonths?: number;
}

// ---------------------------------------------------------------------------
// Output Types
// ---------------------------------------------------------------------------

export interface YearlyProjection {
  year: number;
  cashFlow: number;
  equity: number;
  cumulativeReturn: number;
}

export interface ROIResult {
  name: string;
  dealType: string;
  cashOnCashReturn: number; // annual, as decimal
  totalROI: number; // as decimal
  irr: number; // as decimal
  paybackPeriodMonths: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  yearlyProjection: YearlyProjection[];
  totalInvested: number;
  totalReturns: number;
  netProfit: number;
  disclaimer: string;
}

// ---------------------------------------------------------------------------
// Financial Math Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate monthly mortgage payment.
 * P * [r(1+r)^n] / [(1+r)^n - 1]
 */
function monthlyPayment(principal: number, annualRate: number, termYears: number): number {
  if (principal <= 0 || annualRate <= 0 || termYears <= 0) return 0;

  const r = annualRate / 12;
  const n = termYears * 12;
  const factor = Math.pow(1 + r, n);
  return principal * (r * factor) / (factor - 1);
}

/**
 * Remaining loan balance after k monthly payments.
 */
function remainingBalance(
  principal: number,
  annualRate: number,
  termYears: number,
  monthsPaid: number
): number {
  if (principal <= 0 || annualRate <= 0) return 0;

  const r = annualRate / 12;
  const n = termYears * 12;
  const factor = Math.pow(1 + r, n);
  const factorK = Math.pow(1 + r, monthsPaid);
  return principal * (factor - factorK) / (factor - 1);
}

/**
 * Calculate IRR using Newton's method.
 * Find discount rate r where NPV = 0.
 *
 * NPV(r) = sum of cashFlows[t] / (1+r)^t for t=0..n
 * NPV'(r) = sum of -t * cashFlows[t] / (1+r)^(t+1)
 */
function calculateIRR(cashFlows: number[], maxIterations = 100, tolerance = 0.0001): number {
  if (cashFlows.length === 0) return 0;

  // Start guess
  let r = 0.1;

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dnpv = 0;

    for (let t = 0; t < cashFlows.length; t++) {
      const discountFactor = Math.pow(1 + r, t);
      npv += cashFlows[t] / discountFactor;
      if (t > 0) {
        dnpv -= (t * cashFlows[t]) / Math.pow(1 + r, t + 1);
      }
    }

    if (Math.abs(npv) < tolerance) break;
    if (Math.abs(dnpv) < 1e-10) break; // avoid division by zero

    const newR = r - npv / dnpv;

    // Clamp to reasonable range
    if (newR < -0.99) r = -0.5;
    else if (newR > 10) r = 5;
    else r = newR;
  }

  // If IRR converged to an unreasonable value, return 0
  if (!isFinite(r) || r < -1 || r > 10) return 0;

  return r;
}

// ---------------------------------------------------------------------------
// Calculators
// ---------------------------------------------------------------------------

export function calculateRealEstateROI(inputs: RealEstateROIInputs): ROIResult {
  const {
    purchasePrice,
    downPayment,
    loanRate,
    loanTermYears,
    closingCosts,
    monthlyRentalIncome,
    monthlyExpenses,
    vacancyRate,
    annualAppreciation,
    holdPeriodYears,
  } = inputs;

  const loanAmount = purchasePrice - downPayment;
  const totalCashInvested = downPayment + closingCosts;
  const monthlyMortgage = monthlyPayment(loanAmount, loanRate, loanTermYears);

  // Effective rental income after vacancy
  const effectiveMonthlyRent = monthlyRentalIncome * (1 - vacancyRate);

  // Monthly cash flow = rent - expenses - mortgage
  const monthlyCF = effectiveMonthlyRent - monthlyExpenses - monthlyMortgage;
  const annualCF = monthlyCF * 12;

  // Build yearly projections and IRR cash flows
  const yearlyProjection: YearlyProjection[] = [];
  const irrCashFlows: number[] = [-totalCashInvested]; // Year 0: initial investment

  let cumulativeReturn = 0;

  for (let year = 1; year <= holdPeriodYears; year++) {
    // Account for rent/expense growth (simplified: assume flat for this model)
    const yearCashFlow = annualCF;

    // Equity = down payment + principal paid + appreciation
    const monthsPaid = year * 12;
    const principalPaid = loanAmount - remainingBalance(loanAmount, loanRate, loanTermYears, monthsPaid);
    const propertyValue = purchasePrice * Math.pow(1 + annualAppreciation, year);
    const equity = propertyValue - (loanAmount - principalPaid);

    cumulativeReturn += yearCashFlow;

    yearlyProjection.push({
      year,
      cashFlow: Math.round(yearCashFlow),
      equity: Math.round(equity),
      cumulativeReturn: Math.round(cumulativeReturn),
    });

    // For IRR: last year includes sale proceeds
    if (year === holdPeriodYears) {
      const remainingLoan = remainingBalance(loanAmount, loanRate, loanTermYears, monthsPaid);
      const saleProceeds = propertyValue - remainingLoan;
      irrCashFlows.push(yearCashFlow + saleProceeds);
    } else {
      irrCashFlows.push(yearCashFlow);
    }
  }

  // Total returns = cumulative cash flow + equity at exit
  const finalEquity = yearlyProjection[yearlyProjection.length - 1]?.equity || 0;
  const totalReturns = cumulativeReturn + finalEquity - totalCashInvested;
  const netProfit = totalReturns;

  // Cash-on-cash return = annual cash flow / total cash invested
  const cashOnCashReturn = totalCashInvested > 0 ? annualCF / totalCashInvested : 0;

  // Total ROI
  const totalROI = totalCashInvested > 0 ? netProfit / totalCashInvested : 0;

  // IRR
  const irr = calculateIRR(irrCashFlows);

  // Payback period
  let paybackMonths = 0;
  if (monthlyCF > 0) {
    paybackMonths = Math.ceil(totalCashInvested / monthlyCF);
  } else {
    paybackMonths = holdPeriodYears * 12; // never pays back from cash flow alone
  }

  return {
    name: "Real Estate Investment",
    dealType: "real_estate",
    cashOnCashReturn,
    totalROI,
    irr,
    paybackPeriodMonths: paybackMonths,
    monthlyCashFlow: Math.round(monthlyCF * 100) / 100,
    annualCashFlow: Math.round(annualCF * 100) / 100,
    yearlyProjection,
    totalInvested: Math.round(totalCashInvested * 100) / 100,
    totalReturns: Math.round(totalReturns * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    disclaimer: DISCLAIMER,
  };
}

export function calculatePracticeAcquisitionROI(
  inputs: PracticeAcquisitionROIInputs
): ROIResult {
  const {
    purchasePrice,
    downPayment,
    loanRate,
    loanTermYears,
    currentAnnualRevenue,
    projectedGrowthRate,
    operatingExpenseRatio,
    additionalStaffCost,
  } = inputs;

  const loanAmount = purchasePrice - downPayment;
  const totalCashInvested = downPayment;
  const monthlyMortgage = monthlyPayment(loanAmount, loanRate, loanTermYears);
  const annualDebtService = monthlyMortgage * 12;

  // Build yearly projections
  const yearlyProjection: YearlyProjection[] = [];
  const irrCashFlows: number[] = [-totalCashInvested];
  const projectionYears = Math.max(loanTermYears, 10);

  let cumulativeReturn = 0;

  for (let year = 1; year <= projectionYears; year++) {
    const revenue = currentAnnualRevenue * Math.pow(1 + projectedGrowthRate, year);
    const operatingExpenses = revenue * operatingExpenseRatio;
    const netOperatingIncome = revenue - operatingExpenses - additionalStaffCost;
    const yearCashFlow = netOperatingIncome - annualDebtService;

    // Equity: principal paid down + goodwill/practice value growth
    const monthsPaid = Math.min(year * 12, loanTermYears * 12);
    // Practice value grows with revenue (simplified: 1x revenue multiple)
    const practiceValue = revenue * 1.0;
    const remainingLoan =
      year * 12 >= loanTermYears * 12
        ? 0
        : remainingBalance(loanAmount, loanRate, loanTermYears, monthsPaid);
    const equity = practiceValue - remainingLoan;

    cumulativeReturn += yearCashFlow;

    yearlyProjection.push({
      year,
      cashFlow: Math.round(yearCashFlow),
      equity: Math.round(equity),
      cumulativeReturn: Math.round(cumulativeReturn),
    });

    irrCashFlows.push(yearCashFlow);
  }

  // Year 1 cash flow for cash-on-cash
  const year1CashFlow = yearlyProjection[0]?.cashFlow || 0;
  const annualCF = year1CashFlow;

  const cashOnCashReturn = totalCashInvested > 0 ? annualCF / totalCashInvested : 0;

  // Total returns over projection period
  const totalReturns = cumulativeReturn;
  const netProfit = totalReturns;
  const totalROI = totalCashInvested > 0 ? netProfit / totalCashInvested : 0;

  const irr = calculateIRR(irrCashFlows);

  // Payback period
  let paybackMonths = 0;
  const monthlyCF = annualCF / 12;
  if (monthlyCF > 0) {
    paybackMonths = Math.ceil(totalCashInvested / monthlyCF);
  } else {
    paybackMonths = projectionYears * 12;
  }

  return {
    name: "Practice Acquisition",
    dealType: "practice_acquisition",
    cashOnCashReturn,
    totalROI,
    irr,
    paybackPeriodMonths: paybackMonths,
    monthlyCashFlow: Math.round(monthlyCF * 100) / 100,
    annualCashFlow: Math.round(annualCF * 100) / 100,
    yearlyProjection,
    totalInvested: Math.round(totalCashInvested * 100) / 100,
    totalReturns: Math.round(totalReturns * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    disclaimer: DISCLAIMER,
  };
}

export function calculateEquipmentROI(inputs: EquipmentROIInputs): ROIResult {
  const {
    cost,
    expectedRevenueIncrease,
    usefulLifeYears,
    maintenanceCostAnnual,
    financingRate,
    financingTermMonths,
  } = inputs;

  // Determine financing
  let monthlyDebtService = 0;

  if (financingRate && financingTermMonths && financingTermMonths > 0) {
    const r = financingRate / 12;
    const n = financingTermMonths;
    if (r > 0) {
      const factor = Math.pow(1 + r, n);
      monthlyDebtService = cost * (r * factor) / (factor - 1);
    } else {
      monthlyDebtService = cost / n;
    }
  }

  const annualDebtService = monthlyDebtService * 12;
  const annualNetBenefit = expectedRevenueIncrease - maintenanceCostAnnual - annualDebtService;
  const monthlyCF = annualNetBenefit / 12;

  // Build yearly projections
  const yearlyProjection: YearlyProjection[] = [];
  const irrCashFlows: number[] = [-cost]; // Initial investment

  let cumulativeReturn = 0;

  for (let year = 1; year <= usefulLifeYears; year++) {
    // Depreciation (straight-line)
    const annualDepreciation = cost / usefulLifeYears;
    const bookValue = cost - annualDepreciation * year;

    // Annual cash flow: revenue increase - maintenance - debt service
    const yearDebtService =
      financingTermMonths && year * 12 <= financingTermMonths ? annualDebtService : 0;
    const yearCashFlow =
      expectedRevenueIncrease - maintenanceCostAnnual - yearDebtService;

    cumulativeReturn += yearCashFlow;

    yearlyProjection.push({
      year,
      cashFlow: Math.round(yearCashFlow),
      equity: Math.round(Math.max(bookValue, 0)), // book value as "equity"
      cumulativeReturn: Math.round(cumulativeReturn),
    });

    irrCashFlows.push(yearCashFlow);
  }

  const totalReturns = cumulativeReturn;
  const netProfit = totalReturns - cost;
  const cashOnCashReturn = cost > 0 ? annualNetBenefit / cost : 0;
  const totalROI = cost > 0 ? netProfit / cost : 0;

  const irr = calculateIRR(irrCashFlows);

  // Payback period
  let paybackMonths = 0;
  if (monthlyCF > 0) {
    paybackMonths = Math.ceil(cost / monthlyCF);
  } else {
    paybackMonths = usefulLifeYears * 12;
  }

  return {
    name: "Equipment Purchase",
    dealType: "equipment",
    cashOnCashReturn,
    totalROI,
    irr,
    paybackPeriodMonths: paybackMonths,
    monthlyCashFlow: Math.round(monthlyCF * 100) / 100,
    annualCashFlow: Math.round(annualNetBenefit * 100) / 100,
    yearlyProjection,
    totalInvested: Math.round(cost * 100) / 100,
    totalReturns: Math.round(totalReturns * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    disclaimer: DISCLAIMER,
  };
}
