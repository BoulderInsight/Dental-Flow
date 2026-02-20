"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/finance/metric-card";
import { AdvisoryDisclaimer } from "@/components/ui/advisory-disclaimer";
import {
  BadgeDollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  Save,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertCircle,
  Info,
  Lightbulb,
  Building2,
  DollarSign,
  BarChart3,
} from "lucide-react";
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
import type { ValuationReport } from "@/lib/finance/valuation";

// ── Formatting Helpers ──────────────────────────────────────────────────────

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

function formatMultiplier(n: number): string {
  return `${n.toFixed(2)}x`;
}

// ── Impact Icon Helpers ─────────────────────────────────────────────────────

function ImpactIcon({ impact }: { impact: "positive" | "neutral" | "negative" }) {
  if (impact === "positive") {
    return <CheckCircle2 size={16} className="text-green-400 shrink-0" />;
  }
  if (impact === "negative") {
    return <AlertCircle size={16} className="text-red-400 shrink-0" />;
  }
  return <Info size={16} className="text-yellow-400 shrink-0" />;
}

function impactBorder(impact: "positive" | "neutral" | "negative"): string {
  if (impact === "positive") return "border-l-green-500";
  if (impact === "negative") return "border-l-red-500";
  return "border-l-yellow-500";
}

// ── Valuation Method Card ───────────────────────────────────────────────────

function ValuationMethodCard({
  title,
  icon: Icon,
  baseMetric,
  baseLabel,
  low,
  mid,
  high,
  multiplier,
  color,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  baseMetric: number;
  baseLabel: string;
  low: number;
  mid: number;
  high: number;
  multiplier: { low: number; mid: number; high: number };
  color: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Icon size={18} className={color} />
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-muted-foreground">{baseLabel}</p>
          <p className="text-lg font-semibold">{formatCurrencyFull(baseMetric)}</p>
        </div>

        <div className="space-y-2">
          {/* Mid (primary) */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${color.replace("text-", "bg-")}`} />
              <span className="text-sm font-medium">Mid</span>
              <span className="text-xs text-muted-foreground">
                ({formatMultiplier(multiplier.mid)})
              </span>
            </div>
            <span className="text-sm font-bold">{formatCurrencyFull(mid)}</span>
          </div>

          {/* Low */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
              <span className="text-sm text-muted-foreground">Low</span>
              <span className="text-xs text-muted-foreground">
                ({formatMultiplier(multiplier.low)})
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {formatCurrencyFull(low)}
            </span>
          </div>

          {/* High */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
              <span className="text-sm text-muted-foreground">High</span>
              <span className="text-xs text-muted-foreground">
                ({formatMultiplier(multiplier.high)})
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {formatCurrencyFull(high)}
            </span>
          </div>
        </div>

        {/* Visual range bar */}
        <div className="pt-1">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>{formatCurrency(low)}</span>
            <span>{formatCurrency(high)}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden relative">
            <div
              className={`h-full rounded-full ${color.replace("text-", "bg-")} opacity-60`}
              style={{
                width: high > low ? `${((mid - low) / (high - low)) * 100}%` : "50%",
                marginLeft:
                  high > low ? `${((low) / (high)) * 0}%` : "0%",
              }}
            />
            {/* Mid marker */}
            <div
              className={`absolute top-0 w-0.5 h-full ${color.replace("text-", "bg-")}`}
              style={{
                left: high > low ? `${((mid - low) / (high - low)) * 100}%` : "50%",
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Valuation Trend Chart ───────────────────────────────────────────────────

function ValuationTrendChart({
  data,
}: {
  data: Array<{
    date: string;
    estimatedValue: number;
    revenue: number;
    ebitda: number;
  }>;
}) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
        Save snapshots over time to see your valuation trend.
      </div>
    );
  }

  const chartData = data.map((d) => ({
    date: d.date,
    value: Math.round(d.estimatedValue),
    revenue: Math.round(d.revenue),
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickFormatter={(v) => {
            const d = new Date(v + "T00:00:00");
            return d.toLocaleDateString("en-US", {
              month: "short",
              year: "2-digit",
            });
          }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickFormatter={(v) => formatCurrency(v)}
          width={70}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: 12,
          }}
          formatter={(value: number, name: string) => [
            formatCurrencyFull(value),
            name === "value" ? "Est. Value" : "Revenue",
          ]}
          labelFormatter={(label) => {
            const d = new Date(label + "T00:00:00");
            return d.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            });
          }}
        />
        <Legend
          formatter={(value) =>
            value === "value" ? "Estimated Value" : "Annual Revenue"
          }
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="hsl(var(--chart-1))"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="hsl(var(--chart-3))"
          strokeWidth={1.5}
          strokeDasharray="5 5"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function ValuationPage() {
  const queryClient = useQueryClient();

  const {
    data: valuation,
    isLoading,
    error,
  } = useQuery<ValuationReport>({
    queryKey: ["valuation"],
    queryFn: async () => {
      const res = await fetch("/api/finance/valuation");
      if (!res.ok) throw new Error("Failed to load valuation");
      return res.json();
    },
  });

  const {
    data: historyData,
  } = useQuery<{ history: Array<{ date: string; estimatedValue: number; revenue: number; ebitda: number }> }>({
    queryKey: ["valuation-history"],
    queryFn: async () => {
      const res = await fetch("/api/finance/valuation/history");
      if (!res.ok) throw new Error("Failed to load history");
      return res.json();
    },
  });

  const snapshotMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/finance/valuation/snapshot", {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to save snapshot");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["valuation"] });
      queryClient.invalidateQueries({ queryKey: ["valuation-history"] });
    },
  });

  // Combine current valuation's historical values with loaded history
  const historicalValues =
    historyData?.history ?? valuation?.historicalValues ?? [];

  // Count factor impacts
  const positiveCount =
    valuation?.factors.filter((f) => f.impact === "positive").length ?? 0;
  const negativeCount =
    valuation?.factors.filter((f) => f.impact === "negative").length ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Business Valuation</h1>
          <p className="text-muted-foreground">
            Estimated practice value based on trailing 12-month financials
            {valuation?.industryName
              ? ` and ${valuation.industryName} industry multiples`
              : ""}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => snapshotMutation.mutate()}
          disabled={snapshotMutation.isPending || isLoading}
        >
          <Save size={14} />
          <span className="ml-1">
            {snapshotMutation.isPending ? "Saving..." : "Save Snapshot"}
          </span>
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4">
            <p className="text-sm text-red-400">
              Failed to load valuation data. Please try again later.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Hero: Estimated Value */}
      <Card className="bg-gradient-to-br from-card to-card/80 border-primary/20">
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <BadgeDollarSign size={16} />
              <span>Estimated Practice Value</span>
            </div>
            <div className="text-4xl font-bold tracking-tight">
              {isLoading ? (
                <span className="text-muted-foreground">Calculating...</span>
              ) : (
                formatCurrencyFull(valuation?.estimatedValue ?? 0)
              )}
            </div>
            {valuation && (
              <p className="text-sm text-muted-foreground">
                Range: {formatCurrencyFull(valuation.valueRange.low)} &mdash;{" "}
                {formatCurrencyFull(valuation.valueRange.high)}
              </p>
            )}
            {valuation && (
              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                <span>
                  {positiveCount} positive factor{positiveCount !== 1 ? "s" : ""}
                </span>
                <span>
                  {negativeCount} risk factor{negativeCount !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Input Metrics Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Annual Revenue"
          value={
            isLoading ? "--" : formatCurrency(valuation?.annualRevenue ?? 0)
          }
          icon={DollarSign}
          color="text-green-400"
          subtitle="Trailing 12 months"
        />
        <MetricCard
          title="EBITDA"
          value={isLoading ? "--" : formatCurrency(valuation?.ebitda ?? 0)}
          icon={BarChart3}
          color="text-blue-400"
          subtitle={
            valuation
              ? `Margin: ${
                  valuation.annualRevenue > 0
                    ? Math.round(
                        (valuation.ebitda / valuation.annualRevenue) * 100
                      )
                    : 0
                }%`
              : undefined
          }
        />
        <MetricCard
          title="SDE"
          value={isLoading ? "--" : formatCurrency(valuation?.sde ?? 0)}
          icon={BadgeDollarSign}
          color="text-purple-400"
          subtitle="Seller's Discretionary Earnings"
        />
        <MetricCard
          title="Owner Compensation"
          value={
            isLoading
              ? "--"
              : formatCurrency(valuation?.ownerCompensation ?? 0)
          }
          icon={Building2}
          color="text-amber-400"
          subtitle="Draws + salary"
        />
      </div>

      {/* Valuation Methods */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Valuation Methods</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {valuation ? (
            <>
              <ValuationMethodCard
                title="Revenue Multiple"
                icon={DollarSign}
                baseMetric={valuation.annualRevenue}
                baseLabel="Annual Revenue"
                low={valuation.revenueMultiple.low}
                mid={valuation.revenueMultiple.mid}
                high={valuation.revenueMultiple.high}
                multiplier={valuation.revenueMultiple.multiplier}
                color="text-green-400"
              />
              <ValuationMethodCard
                title="EBITDA Multiple"
                icon={BarChart3}
                baseMetric={valuation.ebitda}
                baseLabel="EBITDA"
                low={valuation.ebitdaMultiple.low}
                mid={valuation.ebitdaMultiple.mid}
                high={valuation.ebitdaMultiple.high}
                multiplier={valuation.ebitdaMultiple.multiplier}
                color="text-blue-400"
              />
              <ValuationMethodCard
                title="SDE Multiple"
                icon={BadgeDollarSign}
                baseMetric={valuation.sde}
                baseLabel="Seller's Discretionary Earnings"
                low={valuation.sdeMultiple.low}
                mid={valuation.sdeMultiple.mid}
                high={valuation.sdeMultiple.high}
                multiplier={valuation.sdeMultiple.multiplier}
                color="text-purple-400"
              />
            </>
          ) : (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <div className="h-5 bg-muted/30 rounded animate-pulse" />
                    <div className="h-8 bg-muted/30 rounded animate-pulse" />
                    <div className="h-4 bg-muted/20 rounded animate-pulse w-3/4" />
                    <div className="h-4 bg-muted/20 rounded animate-pulse w-1/2" />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Valuation Trend */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Valuation Trend</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Estimated value over time from saved snapshots
            </p>
          </div>
          {historicalValues.length > 1 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Snapshots</p>
              <p className="text-sm font-medium">{historicalValues.length}</p>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <ValuationTrendChart data={historicalValues} />
        </CardContent>
      </Card>

      {/* Valuation Factors */}
      {valuation && valuation.factors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Valuation Factors</CardTitle>
            <p className="text-xs text-muted-foreground">
              Key drivers affecting your business value
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {valuation.factors.map((factor, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-3 p-3 rounded-md border-l-2 bg-muted/20 ${impactBorder(factor.impact)}`}
                >
                  <ImpactIcon impact={factor.impact} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{factor.factor}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {factor.description}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                      factor.impact === "positive"
                        ? "bg-green-500/10 text-green-400"
                        : factor.impact === "negative"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-yellow-500/10 text-yellow-400"
                    }`}
                  >
                    {factor.impact === "positive" ? (
                      <span className="flex items-center gap-1">
                        <ArrowUpRight size={10} /> Positive
                      </span>
                    ) : factor.impact === "negative" ? (
                      <span className="flex items-center gap-1">
                        <ArrowDownRight size={10} /> Risk
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Minus size={10} /> Neutral
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* What Would Increase My Value? */}
      {valuation && valuation.suggestions.length > 0 && (
        <Card className="border-amber-500/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb size={18} className="text-amber-400" />
              <CardTitle className="text-base">
                What Would Increase My Value?
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {valuation.suggestions.map((suggestion, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-amber-400">
                      {idx + 1}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{suggestion}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Industry Comparison */}
      {valuation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Industry Context</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Revenue Multiple Range</p>
                <p className="font-medium">
                  {formatMultiplier(valuation.revenueMultiple.multiplier.low)} &mdash;{" "}
                  {formatMultiplier(valuation.revenueMultiple.multiplier.high)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {valuation.industryName} typical range
                </p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">EBITDA Multiple Range</p>
                <p className="font-medium">
                  {formatMultiplier(valuation.ebitdaMultiple.multiplier.low)} &mdash;{" "}
                  {formatMultiplier(valuation.ebitdaMultiple.multiplier.high)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {valuation.industryName} typical range
                </p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">SDE Multiple Range</p>
                <p className="font-medium">
                  {formatMultiplier(valuation.sdeMultiple.multiplier.low)} &mdash;{" "}
                  {formatMultiplier(valuation.sdeMultiple.multiplier.high)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {valuation.industryName} typical range
                </p>
              </div>
            </div>
            <div className="mt-4 p-3 rounded-md bg-muted/30 text-xs text-muted-foreground">
              Multiples are based on {valuation.industryName} industry benchmarks
              and reflect typical market ranges for businesses of comparable size
              and profile. Actual multiples may vary based on location, patient
              base, staff quality, equipment condition, lease terms, and market
              conditions at time of sale.
            </div>
          </CardContent>
        </Card>
      )}

      {/* EBITDA & SDE Breakdown */}
      {valuation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Earnings Breakdown</CardTitle>
            <p className="text-xs text-muted-foreground">
              How EBITDA and SDE are calculated from your trailing 12-month data
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {/* EBITDA Breakdown */}
              <div>
                <p className="text-sm font-medium mb-3">
                  EBITDA Calculation
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Net Operating Income
                    </span>
                    <span>
                      {formatCurrencyFull(
                        valuation.ebitda -
                          valuation.depreciationAmortization -
                          valuation.interestExpense
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>+ Depreciation & Amortization</span>
                    <span>
                      {valuation.depreciationAmortization > 0
                        ? formatCurrencyFull(valuation.depreciationAmortization)
                        : "Not detected"}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>+ Interest Expense</span>
                    <span>
                      {valuation.interestExpense > 0
                        ? formatCurrencyFull(valuation.interestExpense)
                        : "Not detected"}
                    </span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between font-medium">
                    <span>EBITDA</span>
                    <span className="text-blue-400">
                      {formatCurrencyFull(valuation.ebitda)}
                    </span>
                  </div>
                </div>
                {valuation.depreciationAmortization === 0 &&
                  valuation.interestExpense === 0 && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      No depreciation, amortization, or interest accounts
                      detected. EBITDA equals NOI. If you track these in QBO,
                      ensure account names include those terms.
                    </p>
                  )}
              </div>

              {/* SDE Breakdown */}
              <div>
                <p className="text-sm font-medium mb-3">SDE Calculation</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      True Net Profit
                    </span>
                    <span>
                      {formatCurrencyFull(
                        valuation.sde - valuation.ownerCompensation
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>+ Owner Compensation</span>
                    <span>
                      {formatCurrencyFull(valuation.ownerCompensation)}
                    </span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between font-medium">
                    <span>SDE</span>
                    <span className="text-purple-400">
                      {formatCurrencyFull(valuation.sde)}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2 italic">
                  Seller&apos;s Discretionary Earnings represents the total financial
                  benefit to a single owner-operator.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <AdvisoryDisclaimer />
    </div>
  );
}
