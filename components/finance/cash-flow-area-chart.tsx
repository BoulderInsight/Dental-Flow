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
} from "recharts";

interface MonthlyFreeCash {
  month: string;
  businessFreeCash: number;
  personalFreeCash: number;
  combinedFreeCash: number;
}

export function CashFlowAreaChart({ data }: { data: MonthlyFreeCash[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No cash flow data available
      </div>
    );
  }

  const formatted = data.map((d) => ({
    month: d.month,
    Business: d.businessFreeCash,
    Personal: d.personalFreeCash,
    Combined: d.combinedFreeCash,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={formatted}>
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
          formatter={(value: number) =>
            `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
          }
        />
        <Legend />
        <Area
          type="monotone"
          dataKey="Business"
          stackId="1"
          fill="#3b82f6"
          fillOpacity={0.3}
          stroke="#3b82f6"
        />
        <Area
          type="monotone"
          dataKey="Personal"
          stackId="2"
          fill="#a855f7"
          fillOpacity={0.3}
          stroke="#a855f7"
        />
        <Line
          type="monotone"
          dataKey="Combined"
          stroke="#14b8a6"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function formatMonth(v: string) {
  const [, m] = v.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return months[parseInt(m) - 1] || v;
}
