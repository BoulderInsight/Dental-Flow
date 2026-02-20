"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface CashFlowData {
  month: string;
  income: string;
  expenses: string;
}

export function CashFlowChart({ data }: { data: CashFlowData[] }) {
  const formatted = data.map((d) => ({
    month: d.month,
    Income: parseFloat(d.income),
    Expenses: parseFloat(d.expenses),
  }));

  if (formatted.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No cash flow data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis
          dataKey="month"
          tick={{ fill: "#888", fontSize: 12 }}
          tickFormatter={(v) => {
            const [, m] = v.split("-");
            const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            return months[parseInt(m) - 1] || v;
          }}
        />
        <YAxis
          tick={{ fill: "#888", fontSize: 12 }}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          contentStyle={{ backgroundColor: "#1c1c1c", border: "1px solid #333" }}
          formatter={(value: number) =>
            `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
          }
        />
        <Legend />
        <Bar dataKey="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
