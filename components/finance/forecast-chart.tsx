"use client";

import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";

interface HistoricalMonth {
  month: string;
  actual: number;
}

interface ProjectedMonth {
  month: string;
  predicted: number;
  lower80: number;
  upper80: number;
  lower95: number;
  upper95: number;
}

interface ForecastChartProps {
  historical: HistoricalMonth[];
  projected: ProjectedMonth[];
}

export function ForecastChart({ historical, projected }: ForecastChartProps) {
  if (historical.length === 0 && projected.length === 0) {
    return (
      <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
        No forecast data available
      </div>
    );
  }

  // Merge data for the chart
  const chartData = [
    ...historical.map((h) => ({
      month: h.month,
      actual: h.actual,
      predicted: null as number | null,
      lower80: null as number | null,
      upper80: null as number | null,
      lower95: null as number | null,
      upper95: null as number | null,
      band80: null as [number, number] | null,
      band95: null as [number, number] | null,
    })),
    ...projected.map((p) => ({
      month: p.month,
      actual: null as number | null,
      predicted: p.predicted,
      lower80: p.lower80,
      upper80: p.upper80,
      lower95: p.lower95,
      upper95: p.upper95,
      band80: [p.lower80, p.upper80] as [number, number],
      band95: [p.lower95, p.upper95] as [number, number],
    })),
  ];

  // Bridge: connect last historical to first projected
  if (historical.length > 0 && projected.length > 0) {
    const lastActual = historical[historical.length - 1].actual;
    const idx = historical.length - 1;
    chartData[idx].predicted = lastActual;
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <AreaChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis
          dataKey="month"
          tick={{ fill: "#888", fontSize: 12 }}
          tickFormatter={formatMonth}
        />
        <YAxis
          tick={{ fill: "#888", fontSize: 12 }}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          contentStyle={{ backgroundColor: "#1c1c1c", border: "1px solid #333" }}
          formatter={(value, name) => {
            if (value === null || value === undefined) return ["-", String(name)];
            return [`$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 0 })}`, String(name)];
          }}
        />
        <Legend />
        {/* 95% confidence band */}
        <Area
          type="monotone"
          dataKey="upper95"
          stroke="none"
          fill="#3b82f6"
          fillOpacity={0.1}
          name="95% CI"
        />
        <Area
          type="monotone"
          dataKey="lower95"
          stroke="none"
          fill="#fff"
          fillOpacity={0}
          name=""
        />
        {/* 80% confidence band */}
        <Area
          type="monotone"
          dataKey="upper80"
          stroke="none"
          fill="#3b82f6"
          fillOpacity={0.15}
          name="80% CI"
        />
        <Area
          type="monotone"
          dataKey="lower80"
          stroke="none"
          fill="#fff"
          fillOpacity={0}
          name=""
        />
        {/* Actual line */}
        <Line
          type="monotone"
          dataKey="actual"
          stroke="#22c55e"
          strokeWidth={2}
          dot={{ r: 3 }}
          name="Actual"
          connectNulls={false}
        />
        {/* Predicted line */}
        <Line
          type="monotone"
          dataKey="predicted"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="6 3"
          dot={{ r: 3 }}
          name="Forecast"
          connectNulls={false}
        />
        {projected.length > 0 && (
          <ReferenceLine
            x={historical[historical.length - 1]?.month}
            stroke="#666"
            strokeDasharray="3 3"
            label=""
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function formatMonth(v: string) {
  const [, m] = v.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return months[parseInt(m) - 1] || v;
}
