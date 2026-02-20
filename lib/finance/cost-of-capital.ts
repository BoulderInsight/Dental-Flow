import { getLoans } from "./loans";
import type { Loan } from "@/lib/db/schema";

export interface CostOfCapitalReport {
  loans: Array<{
    id: string;
    name: string;
    balance: number;
    rate: number;
    monthlyPayment: number;
    remainingMonths: number;
    totalRemainingInterest: number;
    type: string;
  }>;
  totalDebt: number;
  weightedAverageCost: number;
  totalMonthlyDebtService: number;
  totalAnnualDebtService: number;
  refinanceOpportunities: Array<{
    loanId: string;
    loanName: string;
    currentRate: number;
    estimatedMarketRate: number;
    potentialMonthlySavings: number;
    potentialTotalSavings: number;
    breakEvenMonths: number;
  }>;
  payoffScenarios: {
    avalanche: PayoffPlan;
    snowball: PayoffPlan;
  };
  disclaimer: string;
}

export interface PayoffPlan {
  method: string;
  extraMonthlyPayment: number;
  loans: Array<{
    name: string;
    originalPayoffDate: Date;
    acceleratedPayoffDate: Date;
    interestSaved: number;
  }>;
  totalInterestSaved: number;
  debtFreeDate: Date;
}

const DISCLAIMER =
  "This is not financial advice. Consult your CPA/financial advisor before making refinancing or payoff decisions.";

// Default market rates by loan type for refinance detection
const MARKET_RATES: Record<string, number> = {
  practice_acquisition: 0.075,
  equipment: 0.07,
  real_estate: 0.065,
  line_of_credit: 0.09,
  sba: 0.075,
  vehicle: 0.065,
  other: 0.08,
};

/**
 * Calculate the total remaining interest on a loan using amortization.
 */
function calcRemainingInterest(
  balance: number,
  monthlyRate: number,
  monthlyPayment: number,
  remainingMonths: number
): number {
  let totalInterest = 0;
  let currentBalance = balance;

  for (let m = 0; m < remainingMonths && currentBalance > 0; m++) {
    const interestThisMonth = currentBalance * monthlyRate;
    totalInterest += interestThisMonth;
    const principalThisMonth = monthlyPayment - interestThisMonth;
    currentBalance -= principalThisMonth;
    if (currentBalance < 0) currentBalance = 0;
  }

  return Math.round(totalInterest * 100) / 100;
}

/**
 * Simulate paying off a loan and return months to payoff + total interest paid.
 */
function simulatePayoff(
  balance: number,
  monthlyRate: number,
  monthlyPayment: number
): { months: number; totalInterest: number } {
  let currentBalance = balance;
  let totalInterest = 0;
  let months = 0;
  const maxMonths = 600; // 50 year cap to prevent infinite loops

  while (currentBalance > 0.01 && months < maxMonths) {
    const interestThisMonth = currentBalance * monthlyRate;
    totalInterest += interestThisMonth;
    const principalThisMonth = monthlyPayment - interestThisMonth;
    if (principalThisMonth <= 0) {
      // Payment doesn't cover interest — loan will never be paid off
      return { months: maxMonths, totalInterest: balance * monthlyRate * maxMonths };
    }
    currentBalance -= principalThisMonth;
    months++;
  }

  return { months, totalInterest: Math.round(totalInterest * 100) / 100 };
}

/**
 * Build a payoff plan using the given loan ordering and extra monthly payment.
 */
function buildPayoffPlan(
  orderedLoans: Array<{
    id: string;
    name: string;
    balance: number;
    rate: number;
    monthlyPayment: number;
    remainingMonths: number;
  }>,
  extraMonthlyPayment: number,
  method: string
): PayoffPlan {
  // Deep copy balances for simulation
  const loanStates = orderedLoans.map((l) => ({
    ...l,
    currentBalance: l.balance,
    paidOff: false,
    originalPayoffMonths: 0,
    acceleratedPayoffMonths: 0,
    originalInterest: 0,
    acceleratedInterest: 0,
  }));

  // Calculate original payoff for each loan (no extra payments)
  for (const loan of loanStates) {
    const monthlyRate = loan.rate / 12;
    const result = simulatePayoff(loan.balance, monthlyRate, loan.monthlyPayment);
    loan.originalPayoffMonths = result.months;
    loan.originalInterest = result.totalInterest;
  }

  // Simulate accelerated payoff: apply extra to first unpaid loan in order
  let month = 0;
  const maxMonths = 600;
  const availableExtra = extraMonthlyPayment;

  while (
    loanStates.some((l) => !l.paidOff && l.currentBalance > 0.01) &&
    month < maxMonths
  ) {
    month++;
    let freedUpPayment = 0;

    for (const loan of loanStates) {
      if (loan.paidOff || loan.currentBalance <= 0.01) continue;

      const monthlyRate = loan.rate / 12;
      const interestThisMonth = loan.currentBalance * monthlyRate;
      loan.acceleratedInterest += interestThisMonth;

      // Determine payment: base + any extra allocated to this loan
      // The first unpaid loan in the order gets the extra payment + any freed-up payments
      const isFirstUnpaid = loanStates.find(
        (l) => !l.paidOff && l.currentBalance > 0.01
      )?.id === loan.id;

      const payment = isFirstUnpaid
        ? loan.monthlyPayment + availableExtra + freedUpPayment
        : loan.monthlyPayment;

      const principal = payment - interestThisMonth;
      if (principal > 0) {
        loan.currentBalance -= principal;
      }

      if (loan.currentBalance <= 0.01) {
        loan.currentBalance = 0;
        loan.paidOff = true;
        loan.acceleratedPayoffMonths = month;
        // This loan's payment is now freed up for the next one
        freedUpPayment += loan.monthlyPayment;
      }
    }
  }

  // Handle loans that didn't get paid off in simulation
  for (const loan of loanStates) {
    if (!loan.paidOff) {
      loan.acceleratedPayoffMonths = loan.originalPayoffMonths;
      loan.acceleratedInterest = loan.originalInterest;
    }
  }

  const now = new Date();
  const loanPlans = loanStates.map((loan) => {
    const originalDate = new Date(now);
    originalDate.setMonth(originalDate.getMonth() + loan.originalPayoffMonths);

    const acceleratedDate = new Date(now);
    acceleratedDate.setMonth(
      acceleratedDate.getMonth() + loan.acceleratedPayoffMonths
    );

    return {
      name: loan.name,
      originalPayoffDate: originalDate,
      acceleratedPayoffDate: acceleratedDate,
      interestSaved: Math.max(
        0,
        Math.round((loan.originalInterest - loan.acceleratedInterest) * 100) / 100
      ),
    };
  });

  const totalInterestSaved = loanPlans.reduce(
    (sum, l) => sum + l.interestSaved,
    0
  );

  const maxAcceleratedMonth = Math.max(
    ...loanStates.map((l) => l.acceleratedPayoffMonths),
    0
  );
  const debtFreeDate = new Date(now);
  debtFreeDate.setMonth(debtFreeDate.getMonth() + maxAcceleratedMonth);

  return {
    method,
    extraMonthlyPayment,
    loans: loanPlans,
    totalInterestSaved: Math.round(totalInterestSaved * 100) / 100,
    debtFreeDate,
  };
}

/**
 * Calculate the full cost of capital report.
 */
export async function calculateCostOfCapital(
  practiceId: string,
  extraMonthlyPayment?: number
): Promise<CostOfCapitalReport> {
  const allLoans = await getLoans(practiceId);
  const extra = extraMonthlyPayment ?? 500;

  // Map loans to report format
  const loanDetails = allLoans.map((loan: Loan) => {
    const balance = loan.currentBalance ? parseFloat(loan.currentBalance) : 0;
    const rate = loan.interestRate ? parseFloat(loan.interestRate) : 0;
    const monthlyPayment = loan.monthlyPayment
      ? parseFloat(loan.monthlyPayment)
      : 0;
    const remaining = loan.remainingMonths ?? 0;
    const monthlyRate = rate / 12;

    const totalRemainingInterest =
      balance > 0 && monthlyPayment > 0
        ? calcRemainingInterest(balance, monthlyRate, monthlyPayment, remaining)
        : 0;

    return {
      id: loan.id,
      name: loan.name,
      balance,
      rate,
      monthlyPayment,
      remainingMonths: remaining,
      totalRemainingInterest,
      type: loan.loanType,
    };
  });

  // Totals
  const totalDebt = loanDetails.reduce((sum, l) => sum + l.balance, 0);
  const totalMonthlyDebtService = loanDetails.reduce(
    (sum, l) => sum + l.monthlyPayment,
    0
  );
  const totalAnnualDebtService = totalMonthlyDebtService * 12;

  // Weighted average cost of capital (debt only)
  const weightedAverageCost =
    totalDebt > 0
      ? loanDetails.reduce((sum, l) => sum + l.rate * l.balance, 0) / totalDebt
      : 0;

  // Detect refinance opportunities
  // Flag loans where currentRate > estimatedMarketRate + 1.0%
  const refinanceOpportunities = loanDetails
    .filter((loan) => {
      const marketRate = MARKET_RATES[loan.type] ?? MARKET_RATES.other;
      return loan.rate > marketRate + 0.01 && loan.balance > 0;
    })
    .map((loan) => {
      const marketRate = MARKET_RATES[loan.type] ?? MARKET_RATES.other;
      const monthlyMarketRate = marketRate / 12;
      const currentMonthlyRate = loan.rate / 12;

      // Calculate new monthly payment at market rate for remaining term
      let newMonthlyPayment: number;
      if (monthlyMarketRate === 0) {
        newMonthlyPayment = loan.balance / loan.remainingMonths;
      } else {
        newMonthlyPayment =
          (loan.balance *
            monthlyMarketRate *
            Math.pow(1 + monthlyMarketRate, loan.remainingMonths)) /
          (Math.pow(1 + monthlyMarketRate, loan.remainingMonths) - 1);
      }

      const monthlySavings = loan.monthlyPayment - newMonthlyPayment;

      // Interest remaining at current rate
      const currentTotalInterest = calcRemainingInterest(
        loan.balance,
        currentMonthlyRate,
        loan.monthlyPayment,
        loan.remainingMonths
      );

      // Interest at new rate
      const newTotalInterest = calcRemainingInterest(
        loan.balance,
        monthlyMarketRate,
        newMonthlyPayment,
        loan.remainingMonths
      );

      const totalSavings = currentTotalInterest - newTotalInterest;

      // Estimate closing costs at 1-2% of balance
      const estimatedClosingCosts = loan.balance * 0.015;
      const breakEvenMonths =
        monthlySavings > 0
          ? Math.ceil(estimatedClosingCosts / monthlySavings)
          : 999;

      return {
        loanId: loan.id,
        loanName: loan.name,
        currentRate: loan.rate,
        estimatedMarketRate: marketRate,
        potentialMonthlySavings: Math.round(monthlySavings * 100) / 100,
        potentialTotalSavings: Math.round(totalSavings * 100) / 100,
        breakEvenMonths,
      };
    })
    .filter((opp) => opp.potentialMonthlySavings > 0);

  // Payoff scenarios
  // Avalanche: order by highest interest rate first
  const avalancheOrder = [...loanDetails]
    .filter((l) => l.balance > 0)
    .sort((a, b) => b.rate - a.rate);

  // Snowball: order by lowest balance first
  const snowballOrder = [...loanDetails]
    .filter((l) => l.balance > 0)
    .sort((a, b) => a.balance - b.balance);

  const avalanche = buildPayoffPlan(avalancheOrder, extra, "Avalanche (Highest Rate First)");
  const snowball = buildPayoffPlan(snowballOrder, extra, "Snowball (Lowest Balance First)");

  return {
    loans: loanDetails,
    totalDebt: Math.round(totalDebt * 100) / 100,
    weightedAverageCost: Math.round(weightedAverageCost * 10000) / 10000,
    totalMonthlyDebtService: Math.round(totalMonthlyDebtService * 100) / 100,
    totalAnnualDebtService: Math.round(totalAnnualDebtService * 100) / 100,
    refinanceOpportunities,
    payoffScenarios: { avalanche, snowball },
    disclaimer: DISCLAIMER,
  };
}
