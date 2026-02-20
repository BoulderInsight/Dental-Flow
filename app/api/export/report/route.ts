import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { calculateProfitability } from "@/lib/finance/profitability";
import { calculateFreeCashFlow } from "@/lib/finance/cash-flow";
import { calculateBudgetVsActual, getBudget } from "@/lib/finance/budget";
import { generateMonthlyReport } from "@/lib/export/pdf-report";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "profitability";
    const format = searchParams.get("format") || "csv";
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const now = new Date();
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const endDate = endDateParam
      ? new Date(endDateParam)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    if (format === "csv") {
      const csv = await generateCSV(
        session.practiceId,
        type,
        startDate,
        endDate
      );
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="dentalflow-${type}-${now.toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    if (format === "pdf") {
      const pdfBuffer = await generateMonthlyReport(
        session.practiceId,
        startDate,
        endDate
      );
      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="dentalflow-report-${now.toISOString().slice(0, 10)}.pdf"`,
        },
      });
    }

    return NextResponse.json({ error: "Unsupported format. Use csv or pdf." }, { status: 400 });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}

async function generateCSV(
  practiceId: string,
  type: string,
  startDate: Date,
  endDate: Date
): Promise<string> {
  switch (type) {
    case "profitability": {
      const report = await calculateProfitability(
        practiceId,
        startDate,
        endDate
      );
      const rows: string[] = [
        "Month,Revenue,Operating Expenses,Net Operating Income,Overhead Ratio",
      ];
      for (const m of report.monthlyBreakdown) {
        rows.push(
          `${m.month},${m.revenue.toFixed(2)},${m.operatingExpenses.toFixed(2)},${m.netOperatingIncome.toFixed(2)},${(m.overheadRatio * 100).toFixed(1)}%`
        );
      }
      rows.push("");
      rows.push(`Total Revenue,${report.revenue.total.toFixed(2)}`);
      rows.push(
        `Total Operating Expenses,${report.operatingExpenses.total.toFixed(2)}`
      );
      rows.push(
        `Net Operating Income,${report.netOperatingIncome.toFixed(2)}`
      );
      rows.push(
        `Owner Compensation,${report.ownerCompensation.toFixed(2)}`
      );
      rows.push(`True Net Profit,${report.trueNetProfit.toFixed(2)}`);
      rows.push(
        `Overhead Ratio,${(report.overheadRatio * 100).toFixed(1)}%`
      );

      rows.push("");
      rows.push("Expense Category,Amount");
      for (const [cat, amt] of Object.entries(
        report.operatingExpenses.byCategory
      ).sort(([, a], [, b]) => b - a)) {
        rows.push(`${cat},${amt.toFixed(2)}`);
      }
      return rows.join("\n");
    }

    case "cashflow": {
      const report = await calculateFreeCashFlow(practiceId, 12);
      const rows: string[] = [
        "Month,Business Free Cash,Personal Free Cash,Combined Free Cash",
      ];
      for (const m of report.monthlyTrend) {
        rows.push(
          `${m.month},${m.businessFreeCash.toFixed(2)},${m.personalFreeCash.toFixed(2)},${m.combinedFreeCash.toFixed(2)}`
        );
      }
      rows.push("");
      rows.push(`Business Net Operating Income,${report.business.netOperatingIncome.toFixed(2)}`);
      rows.push(`Business Debt Service,${report.business.debtService.toFixed(2)}`);
      rows.push(`Business Free Cash,${report.business.freeCash.toFixed(2)}`);
      rows.push(`Personal Income,${report.personal.income.toFixed(2)}`);
      rows.push(`Personal Expenses,${report.personal.expenses.toFixed(2)}`);
      rows.push(`Personal Free Cash,${report.personal.freeCash.toFixed(2)}`);
      rows.push(`Combined Free Cash,${report.combined.freeCash.toFixed(2)}`);
      return rows.join("\n");
    }

    case "budget": {
      const year = new Date().getFullYear();
      const budget = await getBudget(practiceId, year);
      if (!budget) return "No budget configured for this year.";

      const vsActual = await calculateBudgetVsActual(practiceId, year);
      const rows: string[] = [
        "Category,Monthly Target,Monthly Actual,Variance,Variance %,Status,YTD Target,YTD Actual",
      ];
      for (const cat of vsActual.categories) {
        rows.push(
          `${cat.accountRef},${cat.monthlyTarget.toFixed(2)},${cat.monthlyActual.toFixed(2)},${cat.variance.toFixed(2)},${cat.variancePercent.toFixed(1)}%,${cat.status},${cat.ytdTarget.toFixed(2)},${cat.ytdActual.toFixed(2)}`
        );
      }
      rows.push("");
      rows.push(`Total,${vsActual.totalTarget.toFixed(2)},${vsActual.totalActual.toFixed(2)},${vsActual.totalVariance.toFixed(2)}`);
      return rows.join("\n");
    }

    default:
      return "Unsupported report type";
  }
}
