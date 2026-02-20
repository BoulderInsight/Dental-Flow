import { calculateProfitability } from "./profitability";
import { getAnnualDebtService } from "./loans";

export interface DebtCapacityReport {
  annualNOI: number;
  annualDebtService: number;
  currentDSCR: number;
  targetDSCR: number;
  maxAnnualDebtService: number;
  availableDebtServiceCapacity: number;
  maxNewLoan: Array<{
    termYears: number;
    rate: number;
    maxLoanAmount: number;
  }>;
  stressTests: Array<{
    revenueChange: number;
    adjustedNOI: number;
    adjustedDSCR: number;
    canServiceExistingDebt: boolean;
    remainingCapacity: number;
  }>;
  disclaimer: string;
}

const DISCLAIMER =
  "This is not financial advice. Consult your CPA/financial advisor before making borrowing decisions.";

/**
 * Calculate the present value of an annuity (max loan amount given a monthly payment capacity).
 * Formula: PV = PMT * [(1 - (1 + r)^-n) / r]
 * where PMT = monthly payment, r = monthly interest rate, n = total months
 */
function pvOfAnnuity(
  monthlyPayment: number,
  annualRate: number,
  termYears: number
): number {
  const monthlyRate = annualRate / 12;
  const totalMonths = termYears * 12;

  if (monthlyRate === 0) {
    return monthlyPayment * totalMonths;
  }

  return (
    monthlyPayment *
    ((1 - Math.pow(1 + monthlyRate, -totalMonths)) / monthlyRate)
  );
}

/**
 * Calculate the debt capacity report for a practice.
 *
 * Key formulas:
 * - DSCR = Net Operating Income / Total Annual Debt Service
 * - Max Annual DS = NOI / Target DSCR
 * - Available Capacity = Max Annual DS - Current Annual DS
 * - Max Loan Amount = PV of annuity using available monthly DS capacity
 * - Stress test: reduce NOI by revenue change % (expenses are sticky), recalculate DSCR
 */
export async function calculateDebtCapacity(
  practiceId: string,
  options?: { targetDSCR?: number; marketRate?: number }
): Promise<DebtCapacityReport> {
  const targetDSCR = options?.targetDSCR ?? 1.25;
  const marketRate = options?.marketRate ?? 0.075; // 7.5% default

  // Get trailing 12 months NOI from profitability engine
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const profitability = await calculateProfitability(
    practiceId,
    startDate,
    endDate
  );

  const annualNOI = profitability.netOperatingIncome;
  const annualRevenue = profitability.revenue.total;
  const annualExpenses = profitability.operatingExpenses.total;

  // Get actual annual debt service from loans table
  const annualDebtService = await getAnnualDebtService(practiceId);

  // Calculate DSCR
  const currentDSCR =
    annualDebtService > 0
      ? Math.round((annualNOI / annualDebtService) * 100) / 100
      : annualNOI > 0
        ? 99.99 // Effectively infinite capacity when no debt
        : 0;

  // Max annual debt service allowed at target DSCR
  const maxAnnualDebtService =
    targetDSCR > 0
      ? Math.round((annualNOI / targetDSCR) * 100) / 100
      : 0;

  // Available capacity
  const availableDebtServiceCapacity = Math.max(
    0,
    Math.round((maxAnnualDebtService - annualDebtService) * 100) / 100
  );

  // Available monthly DS for new loan
  const availableMonthlyDS = availableDebtServiceCapacity / 12;

  // Calculate max new loan at various terms
  const termOptions = [5, 7, 10, 15, 20, 25, 30];
  const maxNewLoan = termOptions.map((termYears) => ({
    termYears,
    rate: marketRate,
    maxLoanAmount:
      availableMonthlyDS > 0
        ? Math.round(pvOfAnnuity(availableMonthlyDS, marketRate, termYears) * 100) / 100
        : 0,
  }));

  // Stress tests: what happens to DSCR at various revenue declines
  // When revenue drops, expenses are "sticky" (they don't drop as much)
  // We model expenses as fully fixed for conservatism
  const stressScenarios = [-0.1, -0.2, -0.3, -0.4, -0.5];
  const stressTests = stressScenarios.map((revenueChange) => {
    // Adjusted revenue = revenue * (1 + revenueChange) where revenueChange is negative
    const adjustedRevenue = annualRevenue * (1 + revenueChange);
    // Expenses stay the same (sticky), so adjusted NOI drops more steeply
    const adjustedNOI = adjustedRevenue - annualExpenses;
    const adjustedDSCR =
      annualDebtService > 0
        ? Math.round((adjustedNOI / annualDebtService) * 100) / 100
        : adjustedNOI > 0
          ? 99.99
          : 0;

    const adjustedMaxDS =
      targetDSCR > 0 ? adjustedNOI / targetDSCR : 0;

    return {
      revenueChange,
      adjustedNOI: Math.round(adjustedNOI * 100) / 100,
      adjustedDSCR,
      canServiceExistingDebt: adjustedDSCR >= 1.0,
      remainingCapacity: Math.max(
        0,
        Math.round((adjustedMaxDS - annualDebtService) * 100) / 100
      ),
    };
  });

  return {
    annualNOI: Math.round(annualNOI * 100) / 100,
    annualDebtService,
    currentDSCR,
    targetDSCR,
    maxAnnualDebtService,
    availableDebtServiceCapacity,
    maxNewLoan,
    stressTests,
    disclaimer: DISCLAIMER,
  };
}
