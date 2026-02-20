"use client";

import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ScenarioMetrics {
  monthlyRevenue: number;
  monthlyExpenses: number;
  overheadRatio: number;
  netProfit: number;
  businessFreeCash: number;
  combinedFreeCash: number;
  cashRunwayMonths: number;
}

interface NewExpense {
  name: string;
  monthly: number;
}

export default function ScenariosPage() {
  const [revenueChange, setRevenueChange] = useState(0);
  const [newExpenses, setNewExpenses] = useState<NewExpense[]>([]);
  const [newDebtMonthly, setNewDebtMonthly] = useState(0);

  const scenarioMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/finance/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adjustments: {
            revenueChangePct: revenueChange || undefined,
            newExpenses: newExpenses.length > 0 ? newExpenses : undefined,
            newDebtService:
              newDebtMonthly > 0
                ? { monthly: newDebtMonthly, months: 120 }
                : undefined,
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to run scenario");
      return res.json();
    },
  });

  const result = scenarioMutation.data;

  function addExpense() {
    setNewExpenses([...newExpenses, { name: "", monthly: 0 }]);
  }

  function updateExpense(index: number, field: "name" | "monthly", value: string | number) {
    setNewExpenses((prev) =>
      prev.map((e, i) =>
        i === index
          ? { ...e, [field]: field === "monthly" ? Number(value) : value }
          : e
      )
    );
  }

  function removeExpense(index: number) {
    setNewExpenses((prev) => prev.filter((_, i) => i !== index));
  }

  function formatCurrency(n: number): string {
    return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  function MetricRow({
    label,
    base,
    scenario,
    delta,
    format = "currency",
  }: {
    label: string;
    base: number;
    scenario: number;
    delta: number;
    format?: "currency" | "percent" | "months";
  }) {
    const isPositive = delta > 0;
    const isNeutral = Math.abs(delta) < 0.01;
    // For expenses/overhead, lower is better
    const isGood =
      label.includes("Expense") || label.includes("Overhead")
        ? delta < 0
        : delta > 0;

    function fmt(v: number) {
      if (format === "percent") return `${(v * 100).toFixed(1)}%`;
      if (format === "months") return `${v.toFixed(1)} months`;
      return formatCurrency(v);
    }

    return (
      <tr className="border-b border-muted/50">
        <td className="py-3 font-medium">{label}</td>
        <td className="py-3 text-right">{fmt(base)}</td>
        <td className="py-3 text-right">{fmt(scenario)}</td>
        <td
          className={cn(
            "py-3 text-right font-medium",
            isNeutral
              ? "text-muted-foreground"
              : isGood
                ? "text-green-400"
                : "text-red-400"
          )}
        >
          {isNeutral ? "—" : `${isPositive ? "+" : ""}${fmt(delta)}`}
        </td>
      </tr>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scenario Modeling</h1>
        <p className="text-muted-foreground">
          What-if analysis based on your current 3-month average
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Scenario Builder */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Build Your Scenario</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Revenue Change */}
            <div>
              <label className="text-sm font-medium">Revenue Change</label>
              <div className="flex items-center gap-3 mt-2">
                <input
                  type="range"
                  min={-30}
                  max={30}
                  value={revenueChange}
                  onChange={(e) => setRevenueChange(Number(e.target.value))}
                  className="flex-1"
                />
                <span
                  className={cn(
                    "text-sm font-medium w-14 text-right",
                    revenueChange > 0
                      ? "text-green-400"
                      : revenueChange < 0
                        ? "text-red-400"
                        : "text-muted-foreground"
                  )}
                >
                  {revenueChange > 0 ? "+" : ""}
                  {revenueChange}%
                </span>
              </div>
            </div>

            {/* New Expenses */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">New Expenses</label>
                <Button variant="ghost" size="sm" onClick={addExpense}>
                  <Plus size={14} className="mr-1" />
                  Add
                </Button>
              </div>
              {newExpenses.map((expense, i) => (
                <div key={i} className="flex items-center gap-2 mt-2">
                  <Input
                    placeholder="Name (e.g. Associate Dentist)"
                    value={expense.name}
                    onChange={(e) => updateExpense(i, "name", e.target.value)}
                    className="h-8"
                  />
                  <Input
                    type="number"
                    placeholder="$/mo"
                    value={expense.monthly || ""}
                    onChange={(e) =>
                      updateExpense(i, "monthly", e.target.value)
                    }
                    className="w-28 h-8"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeExpense(i)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>

            {/* New Debt */}
            <div>
              <label className="text-sm font-medium">New Debt Service</label>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm text-muted-foreground">$/mo:</span>
                <Input
                  type="number"
                  value={newDebtMonthly || ""}
                  onChange={(e) => setNewDebtMonthly(Number(e.target.value))}
                  placeholder="0"
                  className="w-32 h-8"
                />
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => scenarioMutation.mutate()}
              disabled={scenarioMutation.isPending}
            >
              <Calculator size={16} className="mr-2" />
              {scenarioMutation.isPending ? "Calculating..." : "Calculate Impact"}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Impact Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            {!result ? (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                Configure a scenario and click Calculate Impact
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-muted">
                        <th className="text-left py-2 font-medium">Metric</th>
                        <th className="text-right py-2 font-medium">Current</th>
                        <th className="text-right py-2 font-medium">Scenario</th>
                        <th className="text-right py-2 font-medium">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      <MetricRow
                        label="Monthly Revenue"
                        base={result.baseCase.monthlyRevenue}
                        scenario={result.scenario.monthlyRevenue}
                        delta={result.deltas.monthlyRevenue}
                      />
                      <MetricRow
                        label="Monthly Expenses"
                        base={result.baseCase.monthlyExpenses}
                        scenario={result.scenario.monthlyExpenses}
                        delta={result.deltas.monthlyExpenses}
                      />
                      <MetricRow
                        label="Overhead Ratio"
                        base={result.baseCase.overheadRatio}
                        scenario={result.scenario.overheadRatio}
                        delta={result.deltas.overheadRatio}
                        format="percent"
                      />
                      <MetricRow
                        label="Net Profit"
                        base={result.baseCase.netProfit}
                        scenario={result.scenario.netProfit}
                        delta={result.deltas.netProfit}
                      />
                      <MetricRow
                        label="Business Free Cash"
                        base={result.baseCase.businessFreeCash}
                        scenario={result.scenario.businessFreeCash}
                        delta={result.deltas.businessFreeCash}
                      />
                      <MetricRow
                        label="Combined Free Cash"
                        base={result.baseCase.combinedFreeCash}
                        scenario={result.scenario.combinedFreeCash}
                        delta={result.deltas.combinedFreeCash}
                      />
                      <MetricRow
                        label="Cash Runway"
                        base={result.baseCase.cashRunwayMonths}
                        scenario={result.scenario.cashRunwayMonths}
                        delta={result.deltas.cashRunwayMonths}
                        format="months"
                      />
                    </tbody>
                  </table>
                </div>

                {/* Summary */}
                {result.summary && (
                  <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-4 text-sm">
                    {result.summary}
                  </div>
                )}

                {/* Warning badges */}
                <div className="flex flex-wrap gap-2">
                  {result.scenario.combinedFreeCash < 0 && (
                    <Badge variant="outline" className="text-red-400 border-red-400/30">
                      Negative Cash Flow
                    </Badge>
                  )}
                  {result.scenario.cashRunwayMonths < 3 && (
                    <Badge variant="outline" className="text-red-400 border-red-400/30">
                      Low Runway
                    </Badge>
                  )}
                  {result.scenario.overheadRatio > 0.75 && (
                    <Badge variant="outline" className="text-orange-400 border-orange-400/30">
                      Critical Overhead
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
