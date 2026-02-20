"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AdvisoryDisclaimer } from "@/components/ui/advisory-disclaimer";
import { MetricCard } from "@/components/finance/metric-card";
import {
  Percent,
  DollarSign,
  TrendingDown,
  ArrowDownRight,
  Landmark,
  Calendar,
} from "lucide-react";
import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  AreaChart,
  Area,
} from "recharts";

interface LoanDetail {
  id: string;
  name: string;
  balance: number;
  rate: number;
  monthlyPayment: number;
  remainingMonths: number;
  totalRemainingInterest: number;
  type: string;
}

interface RefinanceOpportunity {
  loanId: string;
  loanName: string;
  currentRate: number;
  estimatedMarketRate: number;
  potentialMonthlySavings: number;
  potentialTotalSavings: number;
  breakEvenMonths: number;
}

interface PayoffLoan {
  name: string;
  originalPayoffDate: string;
  acceleratedPayoffDate: string;
  interestSaved: number;
}

interface PayoffPlan {
  method: string;
  extraMonthlyPayment: number;
  loans: PayoffLoan[];
  totalInterestSaved: number;
  debtFreeDate: string;
}

interface CostOfCapitalReport {
  loans: LoanDetail[];
  totalDebt: number;
  weightedAverageCost: number;
  totalMonthlyDebtService: number;
  totalAnnualDebtService: number;
  refinanceOpportunities: RefinanceOpportunity[];
  payoffScenarios: {
    avalanche: PayoffPlan;
    snowball: PayoffPlan;
  };
  disclaimer: string;
}

function formatCurrency(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(n) >= 1_000) {
    return `$${(n / 1_000).toFixed(0)}k`;
  }
  return `$${n.toFixed(0)}`;
}

function formatCurrencyFull(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });
}

const RATE_COLORS = [
  "hsl(0, 84%, 60%)",    // Highest rate - red
  "hsl(15, 90%, 55%)",
  "hsl(25, 95%, 53%)",
  "hsl(38, 92%, 50%)",
  "hsl(48, 96%, 53%)",   // Mid - yellow
  "hsl(80, 76%, 45%)",
  "hsl(120, 60%, 40%)",
  "hsl(142, 76%, 36%)",  // Lowest rate - green
];

export default function CostOfCapitalPage() {
  const [extraPayment, setExtraPayment] = useState(500);
  const [payoffMethod, setPayoffMethod] = useState<"avalanche" | "snowball">(
    "avalanche"
  );

  const { data, isLoading } = useQuery<CostOfCapitalReport>({
    queryKey: ["cost-of-capital", extraPayment],
    queryFn: async () => {
      const res = await fetch(
        `/api/finance/cost-of-capital?extraMonthlyPayment=${extraPayment}`
      );
      if (!res.ok) throw new Error("Failed to load cost of capital");
      return res.json();
    },
  });

  // Loan chart data: sorted by rate descending for the bar chart
  const loanChartData = useMemo(() => {
    if (!data) return [];
    return [...data.loans]
      .filter((l) => l.balance > 0)
      .sort((a, b) => b.rate - a.rate)
      .map((l, i) => ({
        name: l.name.length > 20 ? l.name.substring(0, 20) + "..." : l.name,
        fullName: l.name,
        rate: Math.round(l.rate * 10000) / 100,
        balance: l.balance,
        colorIndex: i,
      }));
  }, [data]);

  // Current payoff plan
  const activePlan = useMemo(() => {
    if (!data) return null;
    return payoffMethod === "avalanche"
      ? data.payoffScenarios.avalanche
      : data.payoffScenarios.snowball;
  }, [data, payoffMethod]);

  // Build payoff timeline data for area chart
  const timelineData = useMemo(() => {
    if (!activePlan) return [];
    const points: Array<{ month: string; original: number; accelerated: number }> = [];

    // Show original debt-free date and accelerated date
    if (activePlan.loans.length === 0) return [];

    // Get the maximum dates
    const originalDates = activePlan.loans.map(
      (l) => new Date(l.originalPayoffDate)
    );

    const maxOriginal = new Date(
      Math.max(...originalDates.map((d) => d.getTime()))
    );

    const now = new Date();
    const totalOriginalMonths = Math.max(
      1,
      (maxOriginal.getFullYear() - now.getFullYear()) * 12 +
        (maxOriginal.getMonth() - now.getMonth())
    );

    // Sample every 6 months
    const step = Math.max(1, Math.floor(totalOriginalMonths / 12));
    for (let m = 0; m <= totalOriginalMonths; m += step) {
      const date = new Date(now);
      date.setMonth(date.getMonth() + m);
      const label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      // Count remaining loans at this point
      const remainingOriginal = activePlan.loans.filter(
        (l) => new Date(l.originalPayoffDate) > date
      ).length;
      const remainingAccelerated = activePlan.loans.filter(
        (l) => new Date(l.acceleratedPayoffDate) > date
      ).length;

      points.push({
        month: label,
        original: remainingOriginal,
        accelerated: remainingAccelerated,
      });
    }

    return points;
  }, [activePlan]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Cost of Capital</h1>
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted/30 rounded animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-muted/30 rounded animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Cost of Capital</h1>
        <p className="text-muted-foreground mt-2">
          Unable to load cost of capital data.
        </p>
      </div>
    );
  }

  const hasLoans = data.loans.length > 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cost of Capital</h1>
          <p className="text-muted-foreground">
            Analyze your weighted cost of debt and find savings opportunities
          </p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Weighted Avg Cost
            </CardTitle>
            <Percent size={16} className="text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-400">
              {hasLoans
                ? `${(data.weightedAverageCost * 100).toFixed(2)}%`
                : "--"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Blended interest rate across all debt
            </p>
          </CardContent>
        </Card>
        <MetricCard
          title="Total Outstanding Debt"
          value={hasLoans ? formatCurrency(data.totalDebt) : "$0"}
          icon={Landmark}
          color="text-orange-400"
          subtitle={`${data.loans.length} active loan${data.loans.length !== 1 ? "s" : ""}`}
        />
        <MetricCard
          title="Monthly Debt Service"
          value={hasLoans ? formatCurrency(data.totalMonthlyDebtService) : "$0"}
          icon={Calendar}
          color="text-muted-foreground"
          subtitle="Total monthly payments"
        />
        <MetricCard
          title="Annual Debt Service"
          value={hasLoans ? formatCurrency(data.totalAnnualDebtService) : "$0"}
          icon={DollarSign}
          color="text-muted-foreground"
          subtitle="Total annual payments"
        />
      </div>

      {!hasLoans ? (
        <Card>
          <CardContent className="text-center py-12">
            <Landmark size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground">No loans tracked yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add loans in the{" "}
              <a href="/finance/loans" className="text-blue-400 hover:underline">
                Loan Management
              </a>{" "}
              page to see your cost of capital analysis.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Loans Breakdown Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Debt Breakdown by Interest Rate
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Sorted by rate, highest first. Red = expensive, green = cheap.
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={loanChartData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--muted))"
                      opacity={0.3}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 11,
                      }}
                      axisLine={{ stroke: "hsl(var(--muted))" }}
                    />
                    <YAxis
                      tick={{
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 12,
                      }}
                      axisLine={{ stroke: "hsl(var(--muted))" }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                      }}
                      formatter={(value: number) => [`${value.toFixed(2)}%`, "Interest Rate"]}
                    />
                    <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                      {loanChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            RATE_COLORS[
                              Math.min(index, RATE_COLORS.length - 1)
                            ]
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Detailed loan table */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-muted">
                      <th className="text-left py-2 font-medium">Loan</th>
                      <th className="text-left py-2 font-medium">Type</th>
                      <th className="text-right py-2 font-medium">Balance</th>
                      <th className="text-right py-2 font-medium">Rate</th>
                      <th className="text-right py-2 font-medium">Payment</th>
                      <th className="text-right py-2 font-medium">
                        Remaining
                      </th>
                      <th className="text-right py-2 font-medium">
                        Total Remaining Interest
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.loans.map((loan) => (
                      <tr
                        key={loan.id}
                        className="border-b border-muted/50 hover:bg-muted/30"
                      >
                        <td className="py-2 font-medium">{loan.name}</td>
                        <td className="py-2">
                          <Badge variant="outline" className="text-xs">
                            {loan.type}
                          </Badge>
                        </td>
                        <td className="py-2 text-right">
                          {formatCurrencyFull(loan.balance)}
                        </td>
                        <td className="py-2 text-right">
                          {(loan.rate * 100).toFixed(2)}%
                        </td>
                        <td className="py-2 text-right">
                          {formatCurrencyFull(loan.monthlyPayment)}
                        </td>
                        <td className="py-2 text-right">
                          {loan.remainingMonths} mo
                        </td>
                        <td className="py-2 text-right text-red-400">
                          {formatCurrencyFull(loan.totalRemainingInterest)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-muted font-medium">
                      <td className="py-2">Total</td>
                      <td />
                      <td className="py-2 text-right">
                        {formatCurrencyFull(data.totalDebt)}
                      </td>
                      <td className="py-2 text-right">
                        {(data.weightedAverageCost * 100).toFixed(2)}%
                      </td>
                      <td className="py-2 text-right">
                        {formatCurrencyFull(data.totalMonthlyDebtService)}
                      </td>
                      <td />
                      <td className="py-2 text-right text-red-400">
                        {formatCurrencyFull(
                          data.loans.reduce(
                            (sum, l) => sum + l.totalRemainingInterest,
                            0
                          )
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Refinance Opportunities */}
          {data.refinanceOpportunities.length > 0 && (
            <Card className="border-green-500/30">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ArrowDownRight size={16} className="text-green-400" />
                  <CardTitle className="text-base">
                    Refinance Opportunities
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className="text-green-400 border-green-400/30"
                  >
                    {data.refinanceOpportunities.length} found
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Loans where your rate is more than 1% above estimated market
                  rates
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {data.refinanceOpportunities.map((opp) => (
                    <div
                      key={opp.loanId}
                      className="p-4 rounded-md border border-green-500/20 bg-green-500/5"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium">{opp.loanName}</p>
                        <Badge
                          variant="outline"
                          className="text-green-400 border-green-400/30"
                        >
                          Save {formatCurrencyFull(opp.potentialMonthlySavings)}
                          /mo
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Current Rate</p>
                          <p className="font-medium text-red-400">
                            {(opp.currentRate * 100).toFixed(2)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Market Rate</p>
                          <p className="font-medium text-green-400">
                            {(opp.estimatedMarketRate * 100).toFixed(2)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total Savings</p>
                          <p className="font-medium">
                            {formatCurrencyFull(opp.potentialTotalSavings)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Break-Even</p>
                          <p className="font-medium">
                            {opp.breakEvenMonths} months
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payoff Accelerator */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    Payoff Accelerator
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    See how extra monthly payments speed up debt freedom
                  </p>
                </div>
                {activePlan && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      Interest Saved
                    </p>
                    <p className="text-2xl font-bold text-green-400">
                      {formatCurrencyFull(activePlan.totalInterestSaved)}
                    </p>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Controls */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground whitespace-nowrap">
                    Extra Monthly:
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="100"
                      value={extraPayment}
                      onChange={(e) =>
                        setExtraPayment(Math.max(0, parseInt(e.target.value) || 0))
                      }
                      className="w-28 h-8 text-right"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant={payoffMethod === "avalanche" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPayoffMethod("avalanche")}
                  >
                    <TrendingDown size={14} className="mr-1" />
                    Avalanche
                  </Button>
                  <Button
                    variant={payoffMethod === "snowball" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPayoffMethod("snowball")}
                  >
                    <DollarSign size={14} className="mr-1" />
                    Snowball
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mb-4">
                {payoffMethod === "avalanche"
                  ? "Avalanche: Pay off highest-rate loans first to minimize total interest."
                  : "Snowball: Pay off smallest-balance loans first for quick wins and motivation."}
              </p>

              {/* Debt-free date */}
              {activePlan && (
                <div className="p-4 rounded-md bg-muted/30 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        Debt-Free Date ({activePlan.method})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        With {formatCurrencyFull(extraPayment)}/mo extra payments
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">
                        {formatDate(activePlan.debtFreeDate)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Timeline chart */}
              {timelineData.length > 0 && (
                <div className="h-48 mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={timelineData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--muted))"
                        opacity={0.3}
                      />
                      <XAxis
                        dataKey="month"
                        tick={{
                          fill: "hsl(var(--muted-foreground))",
                          fontSize: 11,
                        }}
                        axisLine={{ stroke: "hsl(var(--muted))" }}
                      />
                      <YAxis
                        tick={{
                          fill: "hsl(var(--muted-foreground))",
                          fontSize: 12,
                        }}
                        axisLine={{ stroke: "hsl(var(--muted))" }}
                        label={{
                          value: "Active Loans",
                          angle: -90,
                          position: "insideLeft",
                          fill: "hsl(var(--muted-foreground))",
                          fontSize: 11,
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                        }}
                      />
                      <Area
                        type="stepAfter"
                        dataKey="original"
                        name="Standard Payoff"
                        stroke="hsl(var(--muted-foreground))"
                        fill="hsl(var(--muted))"
                        fillOpacity={0.3}
                        strokeWidth={2}
                      />
                      <Area
                        type="stepAfter"
                        dataKey="accelerated"
                        name="Accelerated Payoff"
                        stroke="hsl(142, 76%, 36%)"
                        fill="hsl(142, 76%, 36%)"
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Payoff detail table */}
              {activePlan && activePlan.loans.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-muted">
                        <th className="text-left py-2 font-medium">Loan</th>
                        <th className="text-right py-2 font-medium">
                          Original Payoff
                        </th>
                        <th className="text-right py-2 font-medium">
                          Accelerated Payoff
                        </th>
                        <th className="text-right py-2 font-medium">
                          Interest Saved
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePlan.loans.map((loan, i) => (
                        <tr
                          key={i}
                          className="border-b border-muted/50 hover:bg-muted/30"
                        >
                          <td className="py-2 font-medium">{loan.name}</td>
                          <td className="py-2 text-right text-muted-foreground">
                            {formatDate(loan.originalPayoffDate)}
                          </td>
                          <td className="py-2 text-right">
                            {formatDate(loan.acceleratedPayoffDate)}
                          </td>
                          <td className="py-2 text-right text-green-400 font-medium">
                            {formatCurrencyFull(loan.interestSaved)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-muted font-medium">
                        <td className="py-2">Total Interest Saved</td>
                        <td />
                        <td />
                        <td className="py-2 text-right text-green-400 text-lg">
                          {formatCurrencyFull(activePlan.totalInterestSaved)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <AdvisoryDisclaimer />
    </div>
  );
}
