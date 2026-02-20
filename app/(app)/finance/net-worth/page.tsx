"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { RefreshCw, TrendingUp, TrendingDown, Camera } from "lucide-react";
import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";

interface NetWorthReport {
  asOf: string;
  assets: {
    practiceValue: number;
    realEstate: number;
    liquidAssets: number;
    investments: number;
    retirement: number;
    otherAssets: number;
    totalAssets: number;
  };
  liabilities: {
    practiceLoan: number;
    mortgage: number;
    creditCards: number;
    otherLiabilities: number;
    totalLiabilities: number;
  };
  netWorth: number;
  monthlyTrend: Array<{ date: string; netWorth: number }>;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCurrencyShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

const ASSET_COLORS = ["#22c55e", "#3b82f6", "#8b5cf6", "#f59e0b", "#06b6d4", "#6b7280"];
const LIABILITY_COLORS = ["#ef4444", "#f97316", "#ec4899", "#6b7280"];

export default function NetWorthPage() {
  const queryClient = useQueryClient();

  const { data: report, isLoading } = useQuery<NetWorthReport>({
    queryKey: ["net-worth"],
    queryFn: async () => {
      const res = await fetch("/api/finance/net-worth");
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  // Manual entries form state
  const [manualValues, setManualValues] = useState({
    practiceValue: "",
    realEstateValue: "",
    otherAssets: "",
    otherLiabilities: "",
  });

  useEffect(() => {
    if (report) {
      setManualValues({
        practiceValue: report.assets.practiceValue ? String(report.assets.practiceValue) : "",
        realEstateValue: report.assets.realEstate ? String(report.assets.realEstate) : "",
        otherAssets: report.assets.otherAssets ? String(report.assets.otherAssets) : "",
        otherLiabilities: report.liabilities.otherLiabilities
          ? String(report.liabilities.otherLiabilities)
          : "",
      });
    }
  }, [report]);

  const syncMutation = useMutation({
    mutationFn: () => fetch("/api/plaid/sync", { method: "POST" }),
    onSuccess: () => {
      toast.success("Balances refreshed");
      queryClient.invalidateQueries({ queryKey: ["net-worth"] });
    },
    onError: () => toast.error("Failed to refresh balances"),
  });

  const snapshotMutation = useMutation({
    mutationFn: () =>
      fetch("/api/finance/net-worth/snapshot", { method: "POST" }),
    onSuccess: () => {
      toast.success("Snapshot saved");
      queryClient.invalidateQueries({ queryKey: ["net-worth"] });
    },
    onError: () => toast.error("Failed to save snapshot"),
  });

  const manualMutation = useMutation({
    mutationFn: async (values: Record<string, number>) => {
      const res = await fetch("/api/finance/net-worth/manual", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      toast.success("Manual values updated");
      queryClient.invalidateQueries({ queryKey: ["net-worth"] });
    },
    onError: () => toast.error("Failed to update"),
  });

  function handleManualSave() {
    const values: Record<string, number> = {};
    if (manualValues.practiceValue)
      values.practiceValue = parseFloat(manualValues.practiceValue);
    if (manualValues.realEstateValue)
      values.realEstateValue = parseFloat(manualValues.realEstateValue);
    if (manualValues.otherAssets)
      values.otherAssets = parseFloat(manualValues.otherAssets);
    if (manualValues.otherLiabilities)
      values.otherLiabilities = parseFloat(manualValues.otherLiabilities);
    manualMutation.mutate(values);
  }

  // Previous month comparison
  const trend = report?.monthlyTrend || [];
  const lastMonth = trend.length >= 2 ? trend[trend.length - 2] : null;
  const change = lastMonth ? (report?.netWorth || 0) - lastMonth.netWorth : null;

  // Asset breakdown for bar chart
  const assetBreakdown = report
    ? [
        { name: "Practice", value: report.assets.practiceValue },
        { name: "Real Estate", value: report.assets.realEstate },
        { name: "Liquid", value: report.assets.liquidAssets },
        { name: "Investments", value: report.assets.investments },
        { name: "Retirement", value: report.assets.retirement },
        { name: "Other", value: report.assets.otherAssets },
      ].filter((d) => d.value > 0)
    : [];

  const liabilityBreakdown = report
    ? [
        { name: "Practice Loan", value: report.liabilities.practiceLoan },
        { name: "Mortgage", value: report.liabilities.mortgage },
        { name: "Credit Cards", value: report.liabilities.creditCards },
        { name: "Other", value: report.liabilities.otherLiabilities },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Net Worth</h1>
          <p className="text-muted-foreground mt-1">
            Track your total financial position across all accounts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            <RefreshCw
              size={14}
              className={syncMutation.isPending ? "animate-spin" : ""}
            />
            <span className="ml-1">Refresh Balances</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => snapshotMutation.mutate()}
            disabled={snapshotMutation.isPending}
          >
            <Camera size={14} />
            <span className="ml-1">Save Snapshot</span>
          </Button>
        </div>
      </div>

      {/* Big Net Worth Number */}
      <Card>
        <CardContent className="py-8 text-center">
          {isLoading ? (
            <div className="h-16 w-64 mx-auto bg-muted/30 rounded animate-pulse" />
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-1">
                Total Net Worth
              </p>
              <p className="text-5xl font-bold tracking-tight">
                {formatCurrency(report?.netWorth || 0)}
              </p>
              {change !== null && (
                <div className="flex items-center justify-center gap-1 mt-3">
                  {change >= 0 ? (
                    <TrendingUp size={16} className="text-green-400" />
                  ) : (
                    <TrendingDown size={16} className="text-red-400" />
                  )}
                  <span
                    className={`text-sm font-medium ${change >= 0 ? "text-green-400" : "text-red-400"}`}
                  >
                    {formatCurrency(Math.abs(change))} vs last month
                  </span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Asset / Liability Breakdowns */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assets</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 bg-muted/30 rounded animate-pulse" />
            ) : assetBreakdown.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={assetBreakdown} layout="vertical">
                    <XAxis
                      type="number"
                      tickFormatter={formatCurrencyShort}
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={90}
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(v: number) => formatCurrency(v)}
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {assetBreakdown.map((_, i) => (
                        <Cell
                          key={i}
                          fill={ASSET_COLORS[i % ASSET_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="text-right mt-2">
                  <span className="text-sm text-muted-foreground">Total: </span>
                  <span className="text-lg font-bold text-green-400">
                    {formatCurrency(report?.assets.totalAssets || 0)}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No asset data. Connect accounts or enter manual values below.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Liabilities</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 bg-muted/30 rounded animate-pulse" />
            ) : liabilityBreakdown.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={liabilityBreakdown} layout="vertical">
                    <XAxis
                      type="number"
                      tickFormatter={formatCurrencyShort}
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={90}
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(v: number) => formatCurrency(v)}
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {liabilityBreakdown.map((_, i) => (
                        <Cell
                          key={i}
                          fill={LIABILITY_COLORS[i % LIABILITY_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="text-right mt-2">
                  <span className="text-sm text-muted-foreground">Total: </span>
                  <span className="text-lg font-bold text-red-400">
                    {formatCurrency(report?.liabilities.totalLiabilities || 0)}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No liability data.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Net Worth Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-64 bg-muted/30 rounded animate-pulse" />
          ) : trend.length > 1 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trend}>
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#9ca3af", fontSize: 11 }}
                  tickFormatter={(d: string) => {
                    const parts = d.split("-");
                    return `${parts[1]}/${parts[0]?.slice(2)}`;
                  }}
                />
                <YAxis
                  tickFormatter={formatCurrencyShort}
                  tick={{ fill: "#9ca3af", fontSize: 11 }}
                />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="netWorth"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ fill: "#22c55e", r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Save snapshots over time to see your net worth trend.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Manual Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manual Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Enter values for assets and liabilities that are not tracked
            through connected accounts.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-1 block">
                Practice / Business Value
              </label>
              <Input
                type="number"
                placeholder="0"
                value={manualValues.practiceValue}
                onChange={(e) =>
                  setManualValues((p) => ({
                    ...p,
                    practiceValue: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Real Estate Value
              </label>
              <Input
                type="number"
                placeholder="0"
                value={manualValues.realEstateValue}
                onChange={(e) =>
                  setManualValues((p) => ({
                    ...p,
                    realEstateValue: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Other Assets
              </label>
              <Input
                type="number"
                placeholder="0"
                value={manualValues.otherAssets}
                onChange={(e) =>
                  setManualValues((p) => ({
                    ...p,
                    otherAssets: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Other Liabilities
              </label>
              <Input
                type="number"
                placeholder="0"
                value={manualValues.otherLiabilities}
                onChange={(e) =>
                  setManualValues((p) => ({
                    ...p,
                    otherLiabilities: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={handleManualSave}
              disabled={manualMutation.isPending}
            >
              {manualMutation.isPending ? "Saving..." : "Save Manual Values"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
