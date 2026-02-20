"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ForecastChart } from "@/components/finance/forecast-chart";
import { MetricCard } from "@/components/finance/metric-card";
import { Clock, TrendingUp, Percent } from "lucide-react";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const INDUSTRY_SEASONALITY = [
  1.05, 1.0, 1.02, 1.0, 0.98, 0.9, 0.85, 0.88, 0.95, 0.98, 1.08, 1.12,
];

function runwayColor(months: number): string {
  if (months >= 6) return "text-green-400";
  if (months >= 3) return "text-yellow-400";
  return "text-red-400";
}

export default function ForecastPage() {
  const { data: forecast, isLoading } = useQuery({
    queryKey: ["forecast-detail"],
    queryFn: async () => {
      const res = await fetch("/api/finance/forecast?months=6");
      if (!res.ok) throw new Error("Failed to load forecast");
      return res.json();
    },
  });

  const historical = forecast?.historicalMonths || [];
  const projected = forecast?.projectedMonths || [];
  const seasonality: number[] = forecast?.seasonalityIndices || INDUSTRY_SEASONALITY;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cash Flow Forecast</h1>
        <p className="text-muted-foreground">
          Projections based on confirmed business transactions using Holt-Winters
          triple exponential smoothing.
        </p>
      </div>

      {/* Forecast Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
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
        <MetricCard
          title="Projected Overhead"
          value={
            isLoading
              ? "--"
              : `${Math.round((forecast?.metrics?.projectedOverheadRatio || 0) * 100)}%`
          }
          icon={Percent}
        />
        <MetricCard
          title="Trend"
          value={isLoading ? "--" : forecast?.metrics?.trend || "stable"}
          icon={TrendingUp}
          color={
            forecast?.metrics?.trend === "improving"
              ? "text-green-400"
              : forecast?.metrics?.trend === "declining"
                ? "text-red-400"
                : "text-yellow-400"
          }
        />
      </div>

      {/* Main Forecast Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            6-Month Forecast with Confidence Bands
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-[350px] bg-muted/20 rounded animate-pulse" />
          ) : (
            <ForecastChart historical={historical} projected={projected} />
          )}
        </CardContent>
      </Card>

      {/* Seasonality Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seasonality Pattern</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-12 gap-2">
            {MONTH_NAMES.map((month, i) => {
              const practiceIdx = seasonality[i] || 1;
              const industryIdx = INDUSTRY_SEASONALITY[i];
              const pctDiff = Math.round((practiceIdx - 1) * 100);
              const industryDiff = Math.round((industryIdx - 1) * 100);

              let bg = "bg-blue-500/20";
              if (practiceIdx >= 1.05) bg = "bg-green-500/30";
              else if (practiceIdx <= 0.9) bg = "bg-red-500/30";
              else if (practiceIdx <= 0.95) bg = "bg-yellow-500/20";

              return (
                <div
                  key={month}
                  className={`rounded-md p-2 text-center ${bg}`}
                  title={`Your ${month}: ${pctDiff >= 0 ? "+" : ""}${pctDiff}% | Industry: ${industryDiff >= 0 ? "+" : ""}${industryDiff}%`}
                >
                  <div className="text-xs text-muted-foreground">{month}</div>
                  <div className="text-sm font-medium">
                    {pctDiff >= 0 ? "+" : ""}
                    {pctDiff}%
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Ind: {industryDiff >= 0 ? "+" : ""}
                    {industryDiff}%
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Percentage deviation from annual average. Green = above average, Red = below average.
          </p>
        </CardContent>
      </Card>

      {/* Projected Values Table */}
      {projected.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projected Values</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-muted">
                  <th className="text-left py-2">Month</th>
                  <th className="text-right py-2">Predicted</th>
                  <th className="text-right py-2">80% Low</th>
                  <th className="text-right py-2">80% High</th>
                  <th className="text-right py-2">95% Low</th>
                  <th className="text-right py-2">95% High</th>
                </tr>
              </thead>
              <tbody>
                {projected.map((p: { month: string; predicted: number; lower80: number; upper80: number; lower95: number; upper95: number }) => (
                  <tr key={p.month} className="border-b border-muted/50">
                    <td className="py-2">{p.month}</td>
                    <td className="py-2 text-right font-medium">
                      ${p.predicted.toLocaleString()}
                    </td>
                    <td className="py-2 text-right text-muted-foreground">
                      ${p.lower80.toLocaleString()}
                    </td>
                    <td className="py-2 text-right text-muted-foreground">
                      ${p.upper80.toLocaleString()}
                    </td>
                    <td className="py-2 text-right text-muted-foreground">
                      ${p.lower95.toLocaleString()}
                    </td>
                    <td className="py-2 text-right text-muted-foreground">
                      ${p.upper95.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
