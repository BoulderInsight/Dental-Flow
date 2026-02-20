"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CashFlowChart } from "@/components/dashboard/cash-flow-chart";
import { TopCategories } from "@/components/dashboard/top-categories";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { usePermissions } from "@/lib/hooks/use-permissions";
import {
  Receipt,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  DollarSign,
  ArrowRight,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  Sparkles,
  Scale,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useState } from "react";

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

interface CFOBriefingData {
  headline: {
    metric: string;
    value: number;
    change: number;
    changePercent: number;
    trend: "up" | "down" | "flat";
  };
  actionItems: Array<{
    icon: string;
    title: string;
    description: string;
    urgency: "high" | "medium" | "low";
    link: string;
    source: string;
  }>;
  quickStats: {
    monthlyRevenue: number;
    monthlyExpenses: number;
    overheadRatio: number;
    overheadStatus: string;
    freeCashFlow: number;
    cashRunway: number;
    dscr: number;
    practiceValue: number;
    retirementReadiness: number;
  };
  activeAlerts: {
    taxAlerts: number;
    referralOpportunities: number;
    budgetOverages: number;
  };
}

interface OnboardingData {
  steps: Array<{
    id: string;
    title: string;
    description: string;
    isComplete: boolean;
    link: string;
    priority: number;
  }>;
}

const ACTION_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  FileText,
  AlertTriangle,
  Sparkles,
  TrendingDown,
  Scale,
};

function overheadColor(ratio: number): string {
  if (ratio < 0.55) return "text-green-400";
  if (ratio <= 0.65) return "text-yellow-400";
  if (ratio <= 0.75) return "text-orange-400";
  return "text-red-400";
}

function urgencyColor(urgency: "high" | "medium" | "low"): string {
  if (urgency === "high") return "border-red-500/30 bg-red-950/20";
  if (urgency === "medium") return "border-yellow-500/30 bg-yellow-950/20";
  return "border-blue-500/30 bg-blue-950/20";
}

function urgencyBadge(urgency: "high" | "medium" | "low"): string {
  if (urgency === "high") return "bg-red-500/20 text-red-400 border-red-500/30";
  if (urgency === "medium") return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  return "bg-blue-500/20 text-blue-400 border-blue-500/30";
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

export default function DashboardPage() {
  const { canWrite, role } = usePermissions();
  const [onboardingOpen, setOnboardingOpen] = useState(true);

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

  const { data: briefing } = useQuery<CFOBriefingData>({
    queryKey: ["cfo-briefing"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/briefing");
      if (!res.ok) throw new Error("Failed to load briefing");
      return res.json();
    },
  });

  const { data: onboarding } = useQuery<OnboardingData>({
    queryKey: ["onboarding-checklist"],
    queryFn: async () => {
      const res = await fetch("/api/onboarding/checklist");
      if (!res.ok) throw new Error("Failed to load checklist");
      return res.json();
    },
  });

  const completedSteps = onboarding?.steps.filter((s) => s.isComplete).length ?? 0;
  const totalSteps = onboarding?.steps.length ?? 7;
  const showOnboarding = onboarding && completedSteps < 5;

  const totalAlerts =
    (briefing?.activeAlerts.taxAlerts ?? 0) +
    (briefing?.activeAlerts.referralOpportunities ?? 0) +
    (briefing?.activeAlerts.budgetOverages ?? 0);

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
      {role === "accountant" && (
        <div className="flex items-center gap-2 rounded-lg bg-blue-950/50 border border-blue-400/30 px-4 py-3 text-sm text-blue-300">
          <Info size={16} className="shrink-0" />
          Viewing as Accountant (read-only)
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Practice financial overview
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canWrite && <QuickActions />}
          {data?.qboConnected === false && (
            <Badge variant="outline" className="text-yellow-500 border-yellow-500">
              Demo Mode
            </Badge>
          )}
        </div>
      </div>

      {/* CFO Briefing Section */}
      {briefing && (
        <div className="space-y-4">
          {/* Headline + Quick Stats */}
          <div className="grid gap-4 lg:grid-cols-4">
            {/* Headline Metric */}
            <Card className="lg:col-span-1 border-primary/20">
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  {briefing.headline.metric}
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold">
                    {formatCurrency(briefing.headline.value)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  {briefing.headline.trend === "up" ? (
                    <TrendingUp size={14} className="text-green-400" />
                  ) : briefing.headline.trend === "down" ? (
                    <TrendingDown size={14} className="text-red-400" />
                  ) : (
                    <Minus size={14} className="text-muted-foreground" />
                  )}
                  <span
                    className={cn(
                      "text-sm font-medium",
                      briefing.headline.trend === "up"
                        ? "text-green-400"
                        : briefing.headline.trend === "down"
                          ? "text-red-400"
                          : "text-muted-foreground"
                    )}
                  >
                    {briefing.headline.changePercent > 0 ? "+" : ""}
                    {briefing.headline.changePercent}% vs last month
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats Grid */}
            <div className="lg:col-span-3 grid gap-3 grid-cols-2 md:grid-cols-4">
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Overhead</p>
                  <p className={cn("text-xl font-bold", overheadColor(briefing.quickStats.overheadRatio / 100))}>
                    {briefing.quickStats.overheadRatio}%
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Free Cash Flow</p>
                  <p className="text-xl font-bold text-blue-400">
                    {formatCurrency(briefing.quickStats.freeCashFlow)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">DSCR</p>
                  <p className={cn(
                    "text-xl font-bold",
                    briefing.quickStats.dscr >= 1.25 ? "text-green-400" : briefing.quickStats.dscr >= 1.0 ? "text-yellow-400" : "text-red-400"
                  )}>
                    {briefing.quickStats.dscr > 50 ? ">50x" : `${briefing.quickStats.dscr.toFixed(2)}x`}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Practice Value</p>
                  <p className="text-xl font-bold text-emerald-400">
                    {briefing.quickStats.practiceValue > 0
                      ? formatCurrency(briefing.quickStats.practiceValue)
                      : "--"}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Action Items */}
          {briefing.actionItems.length > 0 && (
            <div className="grid gap-3 md:grid-cols-3">
              {briefing.actionItems.map((item, i) => {
                const IconComponent = ACTION_ICONS[item.icon] ?? AlertTriangle;
                return (
                  <Link key={i} href={item.link}>
                    <Card className={cn("h-full transition-colors hover:bg-accent/50 border", urgencyColor(item.urgency))}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            <IconComponent size={16} className="text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium truncate">{item.title}</p>
                              <Badge variant="outline" className={cn("text-[10px] shrink-0", urgencyBadge(item.urgency))}>
                                {item.urgency}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Active Alerts Banner */}
          {totalAlerts > 0 && (
            <div className="flex items-center gap-4 rounded-lg bg-muted/50 border px-4 py-2.5 text-sm">
              <span className="text-muted-foreground font-medium">Active:</span>
              {briefing.activeAlerts.taxAlerts > 0 && (
                <Link href="/finance/tax-strategy" className="flex items-center gap-1.5 text-orange-400 hover:text-orange-300">
                  <FileText size={13} />
                  {briefing.activeAlerts.taxAlerts} tax alert{briefing.activeAlerts.taxAlerts > 1 ? "s" : ""}
                </Link>
              )}
              {briefing.activeAlerts.referralOpportunities > 0 && (
                <Link href="/referrals" className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300">
                  <Sparkles size={13} />
                  {briefing.activeAlerts.referralOpportunities} savings opportunit{briefing.activeAlerts.referralOpportunities > 1 ? "ies" : "y"}
                </Link>
              )}
              {briefing.activeAlerts.budgetOverages > 0 && (
                <Link href="/finance/budget" className="flex items-center gap-1.5 text-yellow-400 hover:text-yellow-300">
                  <AlertTriangle size={13} />
                  {briefing.activeAlerts.budgetOverages} budget overage{briefing.activeAlerts.budgetOverages > 1 ? "s" : ""}
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Onboarding Checklist */}
      {showOnboarding && (
        <Card>
          <CardHeader className="pb-3">
            <button
              onClick={() => setOnboardingOpen(!onboardingOpen)}
              className="flex items-center justify-between w-full text-left"
            >
              <div>
                <CardTitle className="text-base">
                  Get Started — {completedSteps} of {totalSteps} steps complete
                </CardTitle>
                <div className="mt-2 h-1.5 w-64 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
                  />
                </div>
              </div>
              {onboardingOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </CardHeader>
          {onboardingOpen && (
            <CardContent className="pt-0">
              <div className="space-y-2">
                {onboarding!.steps.map((step) => (
                  <Link
                    key={step.id}
                    href={step.link}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-accent/50",
                      step.isComplete && "opacity-60"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                        step.isComplete
                          ? "border-green-500 bg-green-500/20"
                          : "border-muted-foreground/40"
                      )}
                    >
                      {step.isComplete && <CheckCircle size={12} className="text-green-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("font-medium", step.isComplete && "line-through")}>{step.title}</p>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                    <ExternalLink size={14} className="text-muted-foreground shrink-0" />
                  </Link>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

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
