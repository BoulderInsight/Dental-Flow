"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MetricCard } from "@/components/finance/metric-card";
import { AdvisoryDisclaimer } from "@/components/ui/advisory-disclaimer";
import {
  Calculator,
  Building2,
  Stethoscope,
  Wrench,
  Save,
  Trash2,
  ArrowLeftRight,
  TrendingUp,
  DollarSign,
  Percent,
  Clock,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DealType = "real_estate" | "practice_acquisition" | "equipment";

interface YearlyProjection {
  year: number;
  cashFlow: number;
  equity: number;
  cumulativeReturn: number;
}

interface ROIResult {
  name: string;
  dealType: string;
  cashOnCashReturn: number;
  totalROI: number;
  irr: number;
  paybackPeriodMonths: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  yearlyProjection: YearlyProjection[];
  totalInvested: number;
  totalReturns: number;
  netProfit: number;
  disclaimer: string;
}

interface SavedAnalysis {
  id: string;
  name: string;
  dealType: string;
  inputs: Record<string, number>;
  results: ROIResult;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Default inputs
// ---------------------------------------------------------------------------

const DEFAULT_REAL_ESTATE = {
  purchasePrice: 500000,
  downPayment: 100000,
  loanRate: 0.065,
  loanTermYears: 30,
  closingCosts: 15000,
  monthlyRentalIncome: 4000,
  monthlyExpenses: 800,
  vacancyRate: 0.05,
  annualAppreciation: 0.03,
  holdPeriodYears: 10,
};

const DEFAULT_PRACTICE = {
  purchasePrice: 800000,
  downPayment: 200000,
  loanRate: 0.055,
  loanTermYears: 10,
  currentAnnualRevenue: 1200000,
  projectedGrowthRate: 0.05,
  operatingExpenseRatio: 0.60,
  additionalStaffCost: 80000,
};

const DEFAULT_EQUIPMENT = {
  cost: 150000,
  expectedRevenueIncrease: 60000,
  usefulLifeYears: 7,
  maintenanceCostAnnual: 5000,
  financingRate: 0.06,
  financingTermMonths: 60,
};

// ---------------------------------------------------------------------------
// Input field definitions
// ---------------------------------------------------------------------------

interface FieldDef {
  key: string;
  label: string;
  type: "currency" | "percent" | "number" | "years" | "months";
  min?: number;
  max?: number;
  step?: number;
}

const REAL_ESTATE_FIELDS: FieldDef[] = [
  { key: "purchasePrice", label: "Purchase Price", type: "currency" },
  { key: "downPayment", label: "Down Payment", type: "currency" },
  { key: "loanRate", label: "Loan Interest Rate", type: "percent", min: 0, max: 0.25, step: 0.005 },
  { key: "loanTermYears", label: "Loan Term", type: "years", min: 1, max: 40 },
  { key: "closingCosts", label: "Closing Costs", type: "currency" },
  { key: "monthlyRentalIncome", label: "Monthly Rental Income", type: "currency" },
  { key: "monthlyExpenses", label: "Monthly Expenses (tax, ins, maint)", type: "currency" },
  { key: "vacancyRate", label: "Vacancy Rate", type: "percent", min: 0, max: 0.5, step: 0.01 },
  { key: "annualAppreciation", label: "Annual Appreciation", type: "percent", min: 0, max: 0.15, step: 0.005 },
  { key: "holdPeriodYears", label: "Hold Period", type: "years", min: 1, max: 30 },
];

const PRACTICE_FIELDS: FieldDef[] = [
  { key: "purchasePrice", label: "Purchase Price", type: "currency" },
  { key: "downPayment", label: "Down Payment", type: "currency" },
  { key: "loanRate", label: "Loan Interest Rate", type: "percent", min: 0, max: 0.25, step: 0.005 },
  { key: "loanTermYears", label: "Loan Term", type: "years", min: 1, max: 25 },
  { key: "currentAnnualRevenue", label: "Current Annual Revenue", type: "currency" },
  { key: "projectedGrowthRate", label: "Projected Growth Rate", type: "percent", min: 0, max: 0.3, step: 0.01 },
  { key: "operatingExpenseRatio", label: "Operating Expense Ratio", type: "percent", min: 0.3, max: 0.9, step: 0.01 },
  { key: "additionalStaffCost", label: "Additional Staff Cost (annual)", type: "currency" },
];

const EQUIPMENT_FIELDS: FieldDef[] = [
  { key: "cost", label: "Equipment Cost", type: "currency" },
  { key: "expectedRevenueIncrease", label: "Expected Revenue Increase (annual)", type: "currency" },
  { key: "usefulLifeYears", label: "Useful Life", type: "years", min: 1, max: 20 },
  { key: "maintenanceCostAnnual", label: "Annual Maintenance Cost", type: "currency" },
  { key: "financingRate", label: "Financing Rate", type: "percent", min: 0, max: 0.25, step: 0.005 },
  { key: "financingTermMonths", label: "Financing Term", type: "months", min: 0, max: 120 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(n) >= 1000) {
    return `$${(n / 1000).toFixed(1)}k`;
  }
  return `$${n.toFixed(0)}`;
}

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function formatMonths(n: number): string {
  if (n >= 12) {
    const years = Math.floor(n / 12);
    const months = Math.round(n % 12);
    return months > 0 ? `${years}y ${months}mo` : `${years}y`;
  }
  return `${Math.round(n)}mo`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ROIPage() {
  const queryClient = useQueryClient();

  // State
  const [dealType, setDealType] = useState<DealType>("real_estate");
  const [inputs, setInputs] = useState<Record<string, number>>({ ...DEFAULT_REAL_ESTATE });
  const [result, setResult] = useState<ROIResult | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [compareIds, setCompareIds] = useState<[string, string] | null>(null);
  const [calcPending, setCalcPending] = useState(false);

  // -----------------------------------------------------------------------
  // Deal type switching
  // -----------------------------------------------------------------------

  function switchDealType(newType: DealType) {
    setDealType(newType);
    setResult(null);
    switch (newType) {
      case "real_estate":
        setInputs({ ...DEFAULT_REAL_ESTATE });
        break;
      case "practice_acquisition":
        setInputs({ ...DEFAULT_PRACTICE });
        break;
      case "equipment":
        setInputs({ ...DEFAULT_EQUIPMENT });
        break;
    }
  }

  const fields = useMemo(() => {
    switch (dealType) {
      case "real_estate":
        return REAL_ESTATE_FIELDS;
      case "practice_acquisition":
        return PRACTICE_FIELDS;
      case "equipment":
        return EQUIPMENT_FIELDS;
    }
  }, [dealType]);

  // -----------------------------------------------------------------------
  // Debounced live calculation
  // -----------------------------------------------------------------------

  const calculateROI = useCallback(async () => {
    setCalcPending(true);
    try {
      const res = await fetch("/api/finance/roi/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealType, inputs }),
      });
      if (!res.ok) throw new Error("Calculation failed");
      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.error("ROI calculation error:", error);
    } finally {
      setCalcPending(false);
    }
  }, [dealType, inputs]);

  // Debounce calculation on input changes
  useEffect(() => {
    const timer = setTimeout(() => {
      calculateROI();
    }, 500);
    return () => clearTimeout(timer);
  }, [calculateROI]);

  // -----------------------------------------------------------------------
  // Queries & Mutations
  // -----------------------------------------------------------------------

  const { data: analysesData, isLoading: loadingAnalyses } = useQuery({
    queryKey: ["roi-analyses"],
    queryFn: async () => {
      const res = await fetch("/api/finance/roi/analyses");
      if (!res.ok) throw new Error("Failed to load analyses");
      return res.json() as Promise<{ analyses: SavedAnalysis[] }>;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!result) throw new Error("No result to save");
      const res = await fetch("/api/finance/roi/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saveName,
          dealType,
          inputs,
          results: result,
        }),
      });
      if (!res.ok) throw new Error("Failed to save analysis");
      return res.json();
    },
    onSuccess: () => {
      setSaveDialogOpen(false);
      setSaveName("");
      queryClient.invalidateQueries({ queryKey: ["roi-analyses"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/finance/roi/analyses/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roi-analyses"] });
      if (compareIds) setCompareIds(null);
    },
  });

  // -----------------------------------------------------------------------
  // Input handler
  // -----------------------------------------------------------------------

  function updateInput(key: string, value: string, fieldType: string) {
    let numVal = parseFloat(value);
    if (isNaN(numVal)) numVal = 0;

    // For percent fields, store as decimal
    if (fieldType === "percent") {
      numVal = numVal / 100;
    }

    setInputs((prev) => ({ ...prev, [key]: numVal }));
  }

  function getDisplayValue(key: string, fieldType: string): string {
    const val = inputs[key] ?? 0;
    if (fieldType === "percent") {
      return (val * 100).toFixed(1);
    }
    return String(val);
  }

  // -----------------------------------------------------------------------
  // Compare logic
  // -----------------------------------------------------------------------

  const savedAnalyses = analysesData?.analyses || [];

  function handleCompare(id: string) {
    if (!compareIds) {
      setCompareIds([id, ""]);
    } else if (compareIds[0] === id) {
      setCompareIds(null);
    } else {
      setCompareIds([compareIds[0], id]);
    }
  }

  function loadAnalysis(analysis: SavedAnalysis) {
    setDealType(analysis.dealType as DealType);
    setInputs(analysis.inputs);
    setResult(analysis.results);
  }

  const compareAnalyses =
    compareIds && compareIds[0] && compareIds[1]
      ? [
          savedAnalyses.find((a) => a.id === compareIds[0]),
          savedAnalyses.find((a) => a.id === compareIds[1]),
        ].filter(Boolean) as SavedAnalysis[]
      : null;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const dealTypeTabs: Array<{ value: DealType; label: string; icon: typeof Building2 }> = [
    { value: "real_estate", label: "Real Estate", icon: Building2 },
    { value: "practice_acquisition", label: "Practice Acquisition", icon: Stethoscope },
    { value: "equipment", label: "Equipment", icon: Wrench },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">ROI Calculator</h1>
        <p className="text-muted-foreground">
          Analyze return on investment for real estate, practice acquisitions, and equipment
        </p>
      </div>

      {/* Deal Type Tabs */}
      <div className="flex gap-2 border-b border-muted pb-2">
        {dealTypeTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              onClick={() => switchDealType(tab.value)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-t-md text-sm font-medium transition-colors border-b-2",
                dealType === tab.value
                  ? "border-blue-500 text-blue-400 bg-blue-500/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator size={18} />
              Investment Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field) => (
              <div key={field.key}>
                <label className="text-sm font-medium">{field.label}</label>
                <div className="flex items-center gap-2 mt-1">
                  {field.type === "currency" && (
                    <span className="text-sm text-muted-foreground">$</span>
                  )}
                  <Input
                    type="number"
                    value={getDisplayValue(field.key, field.type)}
                    onChange={(e) =>
                      updateInput(field.key, e.target.value, field.type)
                    }
                    min={
                      field.type === "percent" && field.min !== undefined
                        ? field.min * 100
                        : field.min
                    }
                    max={
                      field.type === "percent" && field.max !== undefined
                        ? field.max * 100
                        : field.max
                    }
                    step={
                      field.type === "percent" && field.step
                        ? field.step * 100
                        : field.step
                    }
                    className="h-8"
                  />
                  {field.type === "percent" && (
                    <span className="text-sm text-muted-foreground">%</span>
                  )}
                  {field.type === "years" && (
                    <span className="text-sm text-muted-foreground">years</span>
                  )}
                  {field.type === "months" && (
                    <span className="text-sm text-muted-foreground">months</span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-6">
          {/* Metric Cards */}
          {result && !calcPending ? (
            <>
              <div className="grid gap-4 grid-cols-2">
                <MetricCard
                  title="Cash-on-Cash Return"
                  value={formatPercent(result.cashOnCashReturn)}
                  icon={Percent}
                  color={
                    result.cashOnCashReturn > 0.08
                      ? "text-green-400"
                      : result.cashOnCashReturn > 0
                        ? "text-yellow-400"
                        : "text-red-400"
                  }
                  subtitle="Annual"
                />
                <MetricCard
                  title="Internal Rate of Return"
                  value={formatPercent(result.irr)}
                  icon={TrendingUp}
                  color={
                    result.irr > 0.1
                      ? "text-green-400"
                      : result.irr > 0
                        ? "text-yellow-400"
                        : "text-red-400"
                  }
                  subtitle="Annualized"
                />
                <MetricCard
                  title="Payback Period"
                  value={formatMonths(result.paybackPeriodMonths)}
                  icon={Clock}
                  color={
                    result.paybackPeriodMonths <= 36
                      ? "text-green-400"
                      : result.paybackPeriodMonths <= 72
                        ? "text-yellow-400"
                        : "text-red-400"
                  }
                />
                <MetricCard
                  title="Total ROI"
                  value={formatPercent(result.totalROI)}
                  icon={BarChart3}
                  color={
                    result.totalROI > 0
                      ? "text-green-400"
                      : "text-red-400"
                  }
                  subtitle="Over full period"
                />
              </div>

              {/* Summary Stats */}
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Invested</p>
                      <p className="text-lg font-bold">
                        {formatCurrency(result.totalInvested)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Monthly Cash Flow</p>
                      <p
                        className={cn(
                          "text-lg font-bold",
                          result.monthlyCashFlow >= 0
                            ? "text-green-400"
                            : "text-red-400"
                        )}
                      >
                        {formatCurrency(result.monthlyCashFlow)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Net Profit</p>
                      <p
                        className={cn(
                          "text-lg font-bold",
                          result.netProfit >= 0
                            ? "text-green-400"
                            : "text-red-400"
                        )}
                      >
                        {formatCurrency(result.netProfit)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Save Button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setSaveDialogOpen(true)}
              >
                <Save size={14} className="mr-2" />
                Save Analysis
              </Button>
            </>
          ) : (
            <Card>
              <CardContent className="flex h-[300px] items-center justify-center">
                {calcPending ? (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calculator size={16} className="animate-pulse" />
                    Calculating...
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Enter investment parameters to see ROI analysis
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Yearly Projection Chart */}
      {result && result.yearlyProjection.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Yearly Projection</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={result.yearlyProjection}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey="year"
                  stroke="#888"
                  fontSize={12}
                  tickFormatter={(v) => `Y${v}`}
                />
                <YAxis
                  stroke="#888"
                  fontSize={12}
                  tickFormatter={(v) => formatCurrency(v)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a2e",
                    border: "1px solid #333",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number, name: string) => [
                    `$${value.toLocaleString()}`,
                    name,
                  ]}
                  labelFormatter={(label) => `Year ${label}`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cashFlow"
                  name="Annual Cash Flow"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ fill: "#22c55e", r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="equity"
                  name="Equity"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="cumulativeReturn"
                  name="Cumulative Return"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={{ fill: "#a855f7", r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>

            {/* Yearly Projection Table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-muted">
                    <th className="text-left py-2 font-medium">Year</th>
                    <th className="text-right py-2 font-medium">Annual Cash Flow</th>
                    <th className="text-right py-2 font-medium">Equity</th>
                    <th className="text-right py-2 font-medium">Cumulative Return</th>
                  </tr>
                </thead>
                <tbody>
                  {result.yearlyProjection.map((row) => (
                    <tr key={row.year} className="border-b border-muted/50">
                      <td className="py-2">Year {row.year}</td>
                      <td
                        className={cn(
                          "py-2 text-right font-mono",
                          row.cashFlow >= 0 ? "text-green-400" : "text-red-400"
                        )}
                      >
                        ${row.cashFlow.toLocaleString()}
                      </td>
                      <td className="py-2 text-right font-mono text-blue-400">
                        ${row.equity.toLocaleString()}
                      </td>
                      <td
                        className={cn(
                          "py-2 text-right font-mono",
                          row.cumulativeReturn >= 0
                            ? "text-purple-400"
                            : "text-red-400"
                        )}
                      >
                        ${row.cumulativeReturn.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Saved Analyses */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Save size={18} />
            Saved Analyses
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAnalyses ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />
              ))}
            </div>
          ) : savedAnalyses.length === 0 ? (
            <div className="flex h-[100px] items-center justify-center text-sm text-muted-foreground">
              No saved analyses yet. Calculate an ROI and save it for comparison.
            </div>
          ) : (
            <div className="space-y-2">
              {compareIds && (
                <div className="text-sm text-muted-foreground mb-2">
                  {!compareIds[1]
                    ? "Select a second analysis to compare"
                    : "Comparing two analyses below"}
                </div>
              )}
              {savedAnalyses.map((analysis) => {
                const r = analysis.results;
                const isComparing =
                  compareIds?.includes(analysis.id) || false;
                return (
                  <div
                    key={analysis.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-md border",
                      isComparing
                        ? "border-blue-500/30 bg-blue-500/5"
                        : "border-muted hover:bg-muted/20"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{analysis.name}</p>
                        <Badge variant="outline" className="text-xs">
                          {analysis.dealType === "real_estate"
                            ? "Real Estate"
                            : analysis.dealType === "practice_acquisition"
                              ? "Practice"
                              : "Equipment"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                        <span>IRR: {formatPercent(r.irr)}</span>
                        <span>CoC: {formatPercent(r.cashOnCashReturn)}</span>
                        <span>Payback: {formatMonths(r.paybackPeriodMonths)}</span>
                        <span>
                          {new Date(analysis.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => loadAnalysis(analysis)}
                        title="Load into calculator"
                      >
                        <Calculator size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCompare(analysis.id)}
                        title="Compare"
                        className={isComparing ? "text-blue-400" : ""}
                      >
                        <ArrowLeftRight size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(analysis.id)}
                        disabled={deleteMutation.isPending}
                        title="Delete"
                        className="text-muted-foreground hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparison View */}
      {compareAnalyses && compareAnalyses.length === 2 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowLeftRight size={18} />
              Side-by-Side Comparison
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCompareIds(null)}
            >
              Clear
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-muted">
                    <th className="text-left py-2 font-medium">Metric</th>
                    <th className="text-right py-2 font-medium">
                      {compareAnalyses[0].name}
                    </th>
                    <th className="text-right py-2 font-medium">
                      {compareAnalyses[1].name}
                    </th>
                    <th className="text-right py-2 font-medium">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      label: "Deal Type",
                      a: compareAnalyses[0].dealType,
                      b: compareAnalyses[1].dealType,
                      format: "text" as const,
                    },
                    {
                      label: "Total Invested",
                      a: compareAnalyses[0].results.totalInvested,
                      b: compareAnalyses[1].results.totalInvested,
                      format: "currency" as const,
                    },
                    {
                      label: "Cash-on-Cash Return",
                      a: compareAnalyses[0].results.cashOnCashReturn,
                      b: compareAnalyses[1].results.cashOnCashReturn,
                      format: "percent" as const,
                    },
                    {
                      label: "IRR",
                      a: compareAnalyses[0].results.irr,
                      b: compareAnalyses[1].results.irr,
                      format: "percent" as const,
                    },
                    {
                      label: "Total ROI",
                      a: compareAnalyses[0].results.totalROI,
                      b: compareAnalyses[1].results.totalROI,
                      format: "percent" as const,
                    },
                    {
                      label: "Monthly Cash Flow",
                      a: compareAnalyses[0].results.monthlyCashFlow,
                      b: compareAnalyses[1].results.monthlyCashFlow,
                      format: "currency" as const,
                    },
                    {
                      label: "Payback Period",
                      a: compareAnalyses[0].results.paybackPeriodMonths,
                      b: compareAnalyses[1].results.paybackPeriodMonths,
                      format: "months" as const,
                    },
                    {
                      label: "Net Profit",
                      a: compareAnalyses[0].results.netProfit,
                      b: compareAnalyses[1].results.netProfit,
                      format: "currency" as const,
                    },
                  ].map((row) => {
                    const fmt = (v: number | string) => {
                      if (typeof v === "string") return v;
                      switch (row.format) {
                        case "currency":
                          return formatCurrency(v);
                        case "percent":
                          return formatPercent(v);
                        case "months":
                          return formatMonths(v);
                        default:
                          return String(v);
                      }
                    };
                    const diff =
                      typeof row.a === "number" && typeof row.b === "number"
                        ? row.a - row.b
                        : null;
                    // For payback, lower is better
                    const lowerIsBetter = row.label === "Payback Period";
                    const diffPositive = diff !== null && (lowerIsBetter ? diff < 0 : diff > 0);

                    return (
                      <tr
                        key={row.label}
                        className="border-b border-muted/50"
                      >
                        <td className="py-2 font-medium">{row.label}</td>
                        <td className="py-2 text-right">{fmt(row.a)}</td>
                        <td className="py-2 text-right">{fmt(row.b)}</td>
                        <td
                          className={cn(
                            "py-2 text-right font-medium",
                            diff === null || Math.abs(diff) < 0.001
                              ? "text-muted-foreground"
                              : diffPositive
                                ? "text-green-400"
                                : "text-red-400"
                          )}
                        >
                          {diff === null
                            ? "—"
                            : row.format === "text"
                              ? "—"
                              : `${diff > 0 ? "+" : ""}${fmt(diff)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent onClose={() => setSaveDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>Save ROI Analysis</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium">Analysis Name</label>
              <Input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder={`e.g., ${
                  dealType === "real_estate"
                    ? "123 Main St Investment Property"
                    : dealType === "practice_acquisition"
                      ? "Dr. Smith Practice Purchase"
                      : "New CBCT Scanner"
                }`}
                className="mt-1"
              />
            </div>
            {saveMutation.isError && (
              <p className="text-sm text-red-400">
                {(saveMutation.error as Error)?.message || "Failed to save"}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setSaveDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!saveName.trim() || saveMutation.isPending}
              >
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Advisory Disclaimer */}
      <AdvisoryDisclaimer />
    </div>
  );
}
