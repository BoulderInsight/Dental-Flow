"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/finance/metric-card";
import { ProfitabilityChart } from "@/components/finance/profitability-chart";
import { CashFlowAreaChart } from "@/components/finance/cash-flow-area-chart";
import { ForecastChart } from "@/components/finance/forecast-chart";
import { InsightsPanel } from "@/components/finance/insights-panel";
import {
  DollarSign,
  Percent,
  Wallet,
  Clock,
  Download,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

function formatCurrency(n: number): string {
  if (Math.abs(n) >= 1000) {
    return `$${(n / 1000).toFixed(1)}k`;
  }
  return `$${n.toFixed(0)}`;
}

function overheadColor(ratio: number): string {
  if (ratio < 0.55) return "text-green-400";
  if (ratio <= 0.65) return "text-yellow-400";
  if (ratio <= 0.75) return "text-orange-400";
  return "text-red-400";
}

function runwayColor(months: number): string {
  if (months >= 6) return "text-green-400";
  if (months >= 3) return "text-yellow-400";
  return "text-red-400";
}

export default function FinancePage() {
  const queryClient = useQueryClient();

  const { data: profitability, isLoading: loadingProfit } = useQuery({
    queryKey: ["profitability"],
    queryFn: async () => {
      // Last 12 months
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const res = await fetch(
        `/api/finance/profitability?startDate=${start.toISOString()}&endDate=${end.toISOString()}`
      );
      if (!res.ok) throw new Error("Failed to load profitability");
      return res.json();
    },
  });

  const { data: cashFlow, isLoading: loadingCash } = useQuery({
    queryKey: ["cashFlow"],
    queryFn: async () => {
      const res = await fetch("/api/finance/cash-flow?months=12");
      if (!res.ok) throw new Error("Failed to load cash flow");
      return res.json();
    },
  });

  const { data: forecast, isLoading: loadingForecast } = useQuery({
    queryKey: ["forecast"],
    queryFn: async () => {
      const res = await fetch("/api/finance/forecast?months=6");
      if (!res.ok) throw new Error("Failed to load forecast");
      return res.json();
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => fetch("/api/finance/snapshot/refresh", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profitability"] });
      queryClient.invalidateQueries({ queryKey: ["cashFlow"] });
      queryClient.invalidateQueries({ queryKey: ["forecast"] });
    },
  });

  const isLoading = loadingProfit || loadingCash || loadingForecast;

  // Compute insights
  const insights = [];
  if (profitability && cashFlow && forecast) {
    const pct = Math.round(profitability.overheadRatio * 100);
    if (profitability.overheadStatus === "healthy") {
      insights.push({ type: "success" as const, text: `Your overhead ratio is ${pct}% — below the 55% benchmark. Excellent cost control.` });
    } else if (profitability.overheadStatus === "normal") {
      insights.push({ type: "info" as const, text: `Your overhead ratio is ${pct}% — within the healthy range for dental practices (55–65%).` });
    } else {
      insights.push({ type: "warning" as const, text: `Your overhead ratio is ${pct}% — above the 65% target. Review your top expense categories.` });
    }

    const excess = cashFlow.combined?.excessCash || 0;
    if (excess > 0) {
      insights.push({ type: "info" as const, text: `You have $${Math.round(excess).toLocaleString()}/mo in excess free cash available for investment.` });
    }

    if (forecast.metrics?.trend === "improving") {
      insights.push({ type: "success" as const, text: "Cash flow is trending upward over the last 3 months." });
    } else if (forecast.metrics?.trend === "declining") {
      insights.push({ type: "warning" as const, text: "Cash flow is trending downward. Monitor closely." });
    }
  }

  // Monthly breakdown for metrics
  const monthly = profitability?.monthlyBreakdown || [];
  const currentMonth = monthly[monthly.length - 1];
  const prevMonth = monthly[monthly.length - 2];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Financial Dashboard</h1>
          <p className="text-muted-foreground">
            Practice profitability, cash flow, and forecasting
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            <RefreshCw size={14} className={refreshMutation.isPending ? "animate-spin" : ""} />
            <span className="ml-1">Refresh</span>
          </Button>
          <Link href="/api/export/report?type=profitability&format=csv">
            <Button variant="outline" size="sm">
              <Download size={14} />
              <span className="ml-1">Export CSV</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Top Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="True Net Profit"
          value={
            isLoading
              ? "--"
              : formatCurrency(currentMonth?.netOperatingIncome || 0)
          }
          icon={DollarSign}
          color="text-green-400"
          trend={
            currentMonth && prevMonth
              ? {
                  value: formatCurrency(
                    currentMonth.netOperatingIncome - prevMonth.netOperatingIncome
                  ),
                  positive:
                    currentMonth.netOperatingIncome > prevMonth.netOperatingIncome,
                }
              : null
          }
          subtitle="Current month"
        />
        <MetricCard
          title="Overhead Ratio"
          value={
            isLoading
              ? "--"
              : `${Math.round((profitability?.overheadRatio || 0) * 100)}%`
          }
          icon={Percent}
          color={overheadColor(profitability?.overheadRatio || 0)}
          subtitle="Target: 55–65%"
        />
        <MetricCard
          title="Combined Free Cash"
          value={
            isLoading
              ? "--"
              : formatCurrency(cashFlow?.combined?.freeCash || 0)
          }
          icon={Wallet}
          color="text-blue-400"
          subtitle={
            cashFlow?.combined?.excessCash > 0
              ? `Excess: ${formatCurrency(cashFlow.combined.excessCash)} for investment`
              : undefined
          }
        />
        <MetricCard
          title="Cash Runway"
          value={
            isLoading
              ? "--"
              : `${forecast?.metrics?.cashRunwayMonths || 0} months`
          }
          icon={Clock}
          color={runwayColor(forecast?.metrics?.cashRunwayMonths || 0)}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Profitability Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Monthly Profitability</CardTitle>
            <Link
              href="/api/export/report?type=profitability&format=csv"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Export
            </Link>
          </CardHeader>
          <CardContent>
            <ProfitabilityChart data={profitability?.monthlyBreakdown || []} />
          </CardContent>
        </Card>

        {/* Expense Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {profitability
                ? Object.entries(profitability.operatingExpenses.byCategory)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .slice(0, 8)
                    .map(([cat, amt]) => {
                      const pct =
                        profitability.operatingExpenses.total > 0
                          ? ((amt as number) / profitability.operatingExpenses.total) * 100
                          : 0;
                      return (
                        <div key={cat} className="flex items-center justify-between text-sm">
                          <span className="truncate">{cat}</span>
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className="text-muted-foreground w-20 text-right">
                              ${((amt as number) / 1000).toFixed(1)}k
                            </span>
                          </div>
                        </div>
                      );
                    })
                : Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-5 bg-muted/30 rounded animate-pulse" />
                  ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cash Flow Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Cash Flow Trend</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Business, personal, and combined free cash flow
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">3-mo Rolling Avg</p>
            <p className="text-lg font-bold text-teal-400">
              {cashFlow ? formatCurrency(cashFlow.rollingAvg3mo) : "--"}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <CashFlowAreaChart data={cashFlow?.monthlyTrend || []} />
        </CardContent>
      </Card>

      {/* Forecast Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">6-Month Forecast</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Holt-Winters triple exponential smoothing with confidence bands
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Trend: </span>
              <span
                className={
                  forecast?.metrics?.trend === "improving"
                    ? "text-green-400"
                    : forecast?.metrics?.trend === "declining"
                      ? "text-red-400"
                      : "text-yellow-400"
                }
              >
                {forecast?.metrics?.trend || "--"}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ForecastChart
            historical={forecast?.historicalMonths || []}
            projected={forecast?.projectedMonths || []}
          />
        </CardContent>
      </Card>

      {/* Insights */}
      {insights.length > 0 && (
        <InsightsPanel insights={insights} />
      )}

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/finance/budget">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <p className="font-medium">Budget Builder</p>
              <p className="text-sm text-muted-foreground">
                Set targets and track spending vs budget
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/finance/scenarios">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <p className="font-medium">Scenario Modeling</p>
              <p className="text-sm text-muted-foreground">
                What-if analysis for hiring, revenue changes
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/forecast">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <p className="font-medium">Detailed Forecast</p>
              <p className="text-sm text-muted-foreground">
                Seasonality patterns and accuracy tracking
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
