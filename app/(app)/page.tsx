"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CashFlowChart } from "@/components/dashboard/cash-flow-chart";
import { TopCategories } from "@/components/dashboard/top-categories";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { Receipt, CheckCircle, AlertTriangle, HelpCircle } from "lucide-react";

interface DashboardData {
  totalTransactions: number;
  categorized: number;
  needsReview: number;
  uncategorized: number;
  qboConnected: boolean;
  monthlyCashFlow: { month: string; income: string; expenses: string }[];
  topCategories: { accountRef: string | null; total: string; count: number }[];
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Failed to load dashboard");
      return res.json();
    },
  });

  const stats = [
    {
      label: "Total Transactions",
      value: data?.totalTransactions ?? "--",
      icon: Receipt,
      description: "All synced transactions",
    },
    {
      label: "Auto-Categorized",
      value: data?.categorized ?? "--",
      icon: CheckCircle,
      description: "High confidence matches",
      color: "text-green-400",
    },
    {
      label: "Needs Review",
      value: data?.needsReview ?? "--",
      icon: AlertTriangle,
      description: "Flagged transactions",
      color: "text-yellow-400",
    },
    {
      label: "Uncategorized",
      value: data?.uncategorized ?? "--",
      icon: HelpCircle,
      description: "Not yet processed",
      color: "text-muted-foreground",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Practice financial overview
          </p>
        </div>
        <div className="flex items-center gap-3">
          <QuickActions />
          {data?.qboConnected === false && (
            <Badge variant="outline" className="text-yellow-500 border-yellow-500">
              Demo Mode
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.label}
              </CardTitle>
              <stat.icon size={16} className={stat.color || "text-muted-foreground"} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stat.color || ""}`}>
                {isLoading ? "--" : stat.value}
              </div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Monthly Cash Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <CashFlowChart data={data?.monthlyCashFlow ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Expense Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <TopCategories data={data?.topCategories ?? []} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
