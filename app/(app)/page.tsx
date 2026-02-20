"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CashFlowChart } from "@/components/dashboard/cash-flow-chart";
import { TopCategories } from "@/components/dashboard/top-categories";
import { QuickActions } from "@/components/dashboard/quick-actions";
import {
  Receipt,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface DashboardData {
  totalTransactions: number;
  categorized: number;
  needsReview: number;
  uncategorized: number;
  qboConnected: boolean;
  monthlyCashFlow: { month: string; income: string; expenses: string }[];
  topCategories: { accountRef: string | null; total: string; count: number }[];
}

interface SnapshotData {
  revenue: number;
  operatingExpenses: number;
  overheadRatio: number;
  netOperatingIncome: number;
  combinedFreeCash: number;
  excessCash: number;
  computedAt: string;
  isStale: boolean;
}

function overheadColor(ratio: number): string {
  if (ratio < 0.55) return "text-green-400";
  if (ratio <= 0.65) return "text-yellow-400";
  if (ratio <= 0.75) return "text-orange-400";
  return "text-red-400";
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

  const { data: snapshot } = useQuery<SnapshotData>({
    queryKey: ["financial-snapshot"],
    queryFn: async () => {
      const res = await fetch("/api/finance/snapshot");
      if (!res.ok) throw new Error("Failed to load snapshot");
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

      {/* Financial Health Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign size={18} className="text-green-400" />
            <CardTitle className="text-base">Financial Health</CardTitle>
          </div>
          <Link
            href="/finance"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            View Financial Details
            <ArrowRight size={14} />
          </Link>
        </CardHeader>
        <CardContent>
          {snapshot ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Overhead Ratio</p>
                <p className={cn("text-2xl font-bold", overheadColor(snapshot.overheadRatio))}>
                  {Math.round(snapshot.overheadRatio * 100)}%
                </p>
                <p className="text-xs text-muted-foreground">Target: 55-65%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Combined Free Cash</p>
                <p className="text-2xl font-bold text-blue-400">
                  ${Math.round(snapshot.combinedFreeCash).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">This month</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net Operating Income</p>
                <p className="text-2xl font-bold text-green-400">
                  ${Math.round(snapshot.netOperatingIncome).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">This month</p>
              </div>
            </div>
          ) : (
            <Link href="/finance" className="block">
              <div className="flex items-center justify-center rounded-lg border border-dashed p-8 text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors">
                Run your first financial analysis
              </div>
            </Link>
          )}
        </CardContent>
      </Card>

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
