"use client";

import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
} from "recharts";

interface MonthlyData {
  month: string;
  revenue: number;
  operatingExpenses: number;
  netOperatingIncome: number;
}

export function ProfitabilityChart({ data }: { data: MonthlyData[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No profitability data available
      </div>
    );
  }

  const formatted = data.map((d) => ({
    month: d.month,
    Revenue: d.revenue,
    Expenses: d.operatingExpenses,
    "Net Profit": d.netOperatingIncome,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={formatted}>
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
          formatter={(value: number) => formatCurrency(value)}
        />
        <Legend />
        <Bar dataKey="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
        <Line
          type="monotone"
          dataKey="Net Profit"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function formatMonth(v: string) {
  const [, m] = v.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return months[parseInt(m) - 1] || v;
}

function formatCurrency(v: number) {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}
