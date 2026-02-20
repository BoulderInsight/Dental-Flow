"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AdvisoryDisclaimer } from "@/components/ui/advisory-disclaimer";
import { MetricCard } from "@/components/finance/metric-card";
import {
  Scale,
  DollarSign,
  TrendingDown,
  Shield,
  Calculator,
} from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from "recharts";

interface DebtCapacityReport {
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

function dscrColor(dscr: number): string {
  if (dscr >= 1.5) return "text-green-400";
  if (dscr >= 1.25) return "text-yellow-400";
  return "text-red-400";
}

function dscrBgColor(dscr: number): string {
  if (dscr >= 1.5) return "bg-green-500";
  if (dscr >= 1.25) return "bg-yellow-500";
  return "bg-red-500";
}

function dscrStatus(dscr: number): string {
  if (dscr >= 1.5) return "Strong";
  if (dscr >= 1.25) return "Adequate";
  if (dscr >= 1.0) return "Tight";
  return "At Risk";
}

export default function DebtCapacityPage() {
  const [targetDSCR, setTargetDSCR] = useState(1.25);
  const [marketRate, setMarketRate] = useState(7.5);
  const [affordabilityAmount, setAffordabilityAmount] = useState("");

  const { data, isLoading } = useQuery<DebtCapacityReport>({
    queryKey: ["debt-capacity", targetDSCR, marketRate],
    queryFn: async () => {
      const res = await fetch(
        `/api/finance/debt-capacity?targetDSCR=${targetDSCR}&marketRate=${marketRate / 100}`
      );
      if (!res.ok) throw new Error("Failed to load debt capacity");
      return res.json();
    },
  });

  // "Can I afford...?" quick calc
  const affordabilityResult = useMemo(() => {
    if (!data || !affordabilityAmount) return null;
    const amount = parseFloat(affordabilityAmount);
    if (isNaN(amount) || amount <= 0) return null;

    // Check which term can support this amount
    const matching = data.maxNewLoan.find((t) => t.maxLoanAmount >= amount);
    if (matching) {
      return {
        canAfford: true,
        message: `Yes, you can borrow ${formatCurrencyFull(amount)} at a ${matching.termYears}-year term (${(matching.rate * 100).toFixed(1)}% rate).`,
      };
    }

    // Find the max they can borrow at longest term
    const maxLoan = data.maxNewLoan[data.maxNewLoan.length - 1];
    if (maxLoan && maxLoan.maxLoanAmount > 0) {
      return {
        canAfford: false,
        message: `Your max borrowing power is ${formatCurrencyFull(maxLoan.maxLoanAmount)} at a ${maxLoan.termYears}-year term. You would need ${formatCurrencyFull(amount - maxLoan.maxLoanAmount)} more capacity.`,
      };
    }

    return {
      canAfford: false,
      message: "No additional borrowing capacity available at current income levels.",
    };
  }, [data, affordabilityAmount]);

  // Stress test chart data
  const stressChartData = useMemo(() => {
    if (!data) return [];
    return data.stressTests.map((st) => ({
      label: `${(st.revenueChange * 100).toFixed(0)}%`,
      dscr: st.adjustedDSCR,
      canService: st.canServiceExistingDebt,
    }));
  }, [data]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Debt Capacity Analysis</h1>
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
        <h1 className="text-2xl font-bold">Debt Capacity Analysis</h1>
        <p className="text-muted-foreground mt-2">
          Unable to load debt capacity data.
        </p>
      </div>
    );
  }

  // Find the "headline" max new loan (10-year default)
  const headline10yr = data.maxNewLoan.find((l) => l.termYears === 10);
  const headlineMaxLoan = headline10yr?.maxLoanAmount ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Debt Capacity Analysis</h1>
          <p className="text-muted-foreground">
            Understand your borrowing power based on current income and debt
            obligations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-sm">
            <label className="text-muted-foreground whitespace-nowrap">
              Target DSCR:
            </label>
            <Input
              type="number"
              step="0.05"
              min="1"
              max="3"
              value={targetDSCR}
              onChange={(e) => setTargetDSCR(parseFloat(e.target.value) || 1.25)}
              className="w-20 h-8 text-right"
            />
          </div>
          <div className="flex items-center gap-1 text-sm">
            <label className="text-muted-foreground whitespace-nowrap">
              Market Rate:
            </label>
            <Input
              type="number"
              step="0.25"
              min="1"
              max="20"
              value={marketRate}
              onChange={(e) => setMarketRate(parseFloat(e.target.value) || 7.5)}
              className="w-20 h-8 text-right"
            />
            <span className="text-muted-foreground">%</span>
          </div>
        </div>
      </div>

      {/* DSCR Gauge + Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* DSCR Gauge Card */}
        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Debt Service Coverage
            </CardTitle>
            <Shield size={16} className={dscrColor(data.currentDSCR)} />
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <div className={cn("text-4xl font-bold", dscrColor(data.currentDSCR))}>
                {data.currentDSCR > 99 ? ">99" : data.currentDSCR.toFixed(2)}x
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Risk</span>
                <span>Strong</span>
              </div>
              <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", dscrBgColor(data.currentDSCR))}
                  style={{
                    width: `${Math.min(100, (data.currentDSCR / 2.5) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-red-400">{"<1.0"}</span>
                <span className="text-yellow-400">1.25</span>
                <span className="text-green-400">{"1.5+"}</span>
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn("mt-2", dscrColor(data.currentDSCR))}
            >
              {dscrStatus(data.currentDSCR)}
            </Badge>
          </CardContent>
        </Card>

        <MetricCard
          title="Annual NOI"
          value={formatCurrency(data.annualNOI)}
          icon={DollarSign}
          color="text-green-400"
          subtitle="Net Operating Income (trailing 12mo)"
        />
        <MetricCard
          title="Annual Debt Service"
          value={formatCurrency(data.annualDebtService)}
          icon={TrendingDown}
          color="text-orange-400"
          subtitle="Total annual loan payments"
        />
        <MetricCard
          title="Available Capacity"
          value={formatCurrency(data.availableDebtServiceCapacity)}
          icon={Scale}
          color="text-blue-400"
          subtitle={`Max new annual DS at ${targetDSCR}x DSCR`}
        />
      </div>

      {/* Borrowing Power */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Your Borrowing Power</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Maximum new loan amounts at {(marketRate).toFixed(1)}% interest rate by
                term length
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                Headline (10yr term)
              </p>
              <p className="text-2xl font-bold text-blue-400">
                {formatCurrencyFull(headlineMaxLoan)}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-muted">
                  <th className="text-left py-2 font-medium">Loan Term</th>
                  <th className="text-right py-2 font-medium">Rate</th>
                  <th className="text-right py-2 font-medium">
                    Max Loan Amount
                  </th>
                  <th className="text-right py-2 font-medium">
                    Monthly Payment
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.maxNewLoan.map((row) => {
                  const monthlyDS = data.availableDebtServiceCapacity / 12;
                  return (
                    <tr
                      key={row.termYears}
                      className={cn(
                        "border-b border-muted/50",
                        row.termYears === 10 && "bg-blue-500/5"
                      )}
                    >
                      <td className="py-2">
                        {row.termYears} years
                        {row.termYears === 10 && (
                          <Badge
                            variant="outline"
                            className="ml-2 text-xs text-blue-400 border-blue-400/30"
                          >
                            Common
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {(row.rate * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 text-right font-medium">
                        {formatCurrencyFull(row.maxLoanAmount)}
                      </td>
                      <td className="py-2 text-right text-muted-foreground">
                        {formatCurrencyFull(monthlyDS)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Stress Tests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue Stress Test</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            How your DSCR changes if revenue declines (expenses remain fixed)
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stressChartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--muted))"
                  opacity={0.3}
                />
                <XAxis
                  type="number"
                  domain={[0, "dataMax"]}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={{ stroke: "hsl(var(--muted))" }}
                />
                <YAxis
                  dataKey="label"
                  type="category"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={{ stroke: "hsl(var(--muted))" }}
                  label={{
                    value: "Revenue Change",
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
                  formatter={(value: number) => [`${value.toFixed(2)}x`, "DSCR"]}
                  labelFormatter={(label: string) => `Revenue ${label}`}
                />
                <ReferenceLine
                  x={1.0}
                  stroke="hsl(var(--destructive))"
                  strokeDasharray="3 3"
                  label={{
                    value: "1.0x minimum",
                    fill: "hsl(var(--destructive))",
                    fontSize: 10,
                  }}
                />
                <ReferenceLine
                  x={data.targetDSCR}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="3 3"
                  label={{
                    value: `${data.targetDSCR}x target`,
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 10,
                  }}
                />
                <Bar dataKey="dscr" radius={[0, 4, 4, 0]}>
                  {stressChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.dscr >= 1.5
                          ? "hsl(142, 76%, 36%)"
                          : entry.dscr >= 1.25
                            ? "hsl(48, 96%, 53%)"
                            : entry.dscr >= 1.0
                              ? "hsl(25, 95%, 53%)"
                              : "hsl(0, 84%, 60%)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Stress test detail table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-muted">
                  <th className="text-left py-2 font-medium">
                    Revenue Change
                  </th>
                  <th className="text-right py-2 font-medium">Adjusted NOI</th>
                  <th className="text-right py-2 font-medium">
                    Adjusted DSCR
                  </th>
                  <th className="text-center py-2 font-medium">
                    Can Service Debt?
                  </th>
                  <th className="text-right py-2 font-medium">
                    Remaining Capacity
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.stressTests.map((st) => (
                  <tr
                    key={st.revenueChange}
                    className="border-b border-muted/50"
                  >
                    <td className="py-2 font-medium">
                      {(st.revenueChange * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 text-right">
                      {formatCurrency(st.adjustedNOI)}
                    </td>
                    <td
                      className={cn(
                        "py-2 text-right font-medium",
                        dscrColor(st.adjustedDSCR)
                      )}
                    >
                      {st.adjustedDSCR > 99
                        ? ">99"
                        : st.adjustedDSCR.toFixed(2)}
                      x
                    </td>
                    <td className="py-2 text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          st.canServiceExistingDebt
                            ? "text-green-400 border-green-400/30"
                            : "text-red-400 border-red-400/30"
                        )}
                      >
                        {st.canServiceExistingDebt ? "Yes" : "No"}
                      </Badge>
                    </td>
                    <td className="py-2 text-right">
                      {formatCurrency(st.remainingCapacity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* "Can I afford...?" Calculator */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calculator size={16} className="text-muted-foreground" />
            <CardTitle className="text-base">Can I Afford...?</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Enter a loan amount to check if it fits within your debt capacity
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-muted-foreground">$</span>
              <Input
                type="number"
                placeholder="Enter loan amount (e.g. 500000)"
                value={affordabilityAmount}
                onChange={(e) => setAffordabilityAmount(e.target.value)}
                className="max-w-xs"
              />
            </div>
          </div>
          {affordabilityResult && (
            <div
              className={cn(
                "mt-4 p-3 rounded-md text-sm",
                affordabilityResult.canAfford
                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              )}
            >
              {affordabilityResult.message}
            </div>
          )}
        </CardContent>
      </Card>

      <AdvisoryDisclaimer />
    </div>
  );
}
