"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdvisoryDisclaimer } from "@/components/ui/advisory-disclaimer";
import { MetricCard } from "@/components/finance/metric-card";
import { usePermissions } from "@/lib/hooks/use-permissions";
import {
  FileText,
  RefreshCw,
  DollarSign,
  Receipt,
  PiggyBank,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface TaxAlertRecord {
  id: string;
  practiceId: string;
  alertType: string;
  title: string;
  description: string;
  priority: string;
  actionUrl: string | null;
  taxYear: number;
  isDismissed: boolean;
  dismissedAt: string | null;
  expiresAt: string | null;
  metadata: {
    potentialSavings?: number;
    deadline?: string;
    actionItems?: string[];
    [key: string]: unknown;
  } | null;
  createdAt: string;
}

function formatCurrency(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(n) >= 1000) {
    return `$${(n / 1000).toFixed(1)}k`;
  }
  return `$${n.toFixed(0)}`;
}

function formatFullCurrency(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function priorityConfig(priority: string) {
  switch (priority) {
    case "high":
      return {
        color: "bg-red-500/15 text-red-400 border-red-500/30",
        icon: AlertTriangle,
        label: "High Priority",
        sortOrder: 0,
      };
    case "medium":
      return {
        color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
        icon: Clock,
        label: "Medium Priority",
        sortOrder: 1,
      };
    case "low":
      return {
        color: "bg-blue-500/15 text-blue-400 border-blue-500/30",
        icon: FileText,
        label: "Low Priority",
        sortOrder: 2,
      };
    default:
      return {
        color: "bg-muted text-muted-foreground",
        icon: FileText,
        label: priority,
        sortOrder: 3,
      };
  }
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function deadlineText(dateStr: string): string {
  const days = daysUntil(dateStr);
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= 7) return `Due in ${days} days`;
  if (days <= 30) return `Due in ${Math.ceil(days / 7)} weeks`;
  return `Due ${new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function deadlineColor(dateStr: string): string {
  const days = daysUntil(dateStr);
  if (days < 0) return "text-red-400";
  if (days <= 7) return "text-orange-400";
  if (days <= 30) return "text-yellow-400";
  return "text-muted-foreground";
}

export default function TaxStrategyPage() {
  const queryClient = useQueryClient();
  const { canWrite } = usePermissions();
  const currentYear = new Date().getFullYear();
  const [taxYear, setTaxYear] = useState(currentYear);
  const [showDismissed, setShowDismissed] = useState(false);
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useQuery({
    queryKey: ["taxAlerts", taxYear],
    queryFn: async () => {
      const res = await fetch(`/api/finance/tax-alerts?taxYear=${taxYear}`);
      if (!res.ok) throw new Error("Failed to load tax alerts");
      return res.json() as Promise<{ alerts: TaxAlertRecord[]; taxYear: number }>;
    },
  });

  const { data: profitability } = useQuery({
    queryKey: ["profitability", "ytd", taxYear],
    queryFn: async () => {
      const start = new Date(taxYear, 0, 1);
      const end =
        taxYear === currentYear
          ? new Date()
          : new Date(taxYear, 11, 31, 23, 59, 59);
      const res = await fetch(
        `/api/finance/profitability?startDate=${start.toISOString()}&endDate=${end.toISOString()}`
      );
      if (!res.ok) throw new Error("Failed to load profitability");
      return res.json();
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/finance/tax-alerts/generate?taxYear=${taxYear}`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Failed to regenerate alerts");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taxAlerts", taxYear] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await fetch(`/api/finance/tax-alerts/${alertId}/dismiss`, {
        method: "PUT",
      });
      if (!res.ok) throw new Error("Failed to dismiss alert");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taxAlerts", taxYear] });
    },
  });

  const alerts = data?.alerts || [];
  const activeAlerts = alerts.filter((a) => !a.isDismissed);
  const dismissedAlerts = alerts.filter((a) => a.isDismissed);
  const displayAlerts = showDismissed ? alerts : activeAlerts;

  // Sort by priority: high -> medium -> low, then by deadline
  const sortedAlerts = [...displayAlerts].sort((a, b) => {
    const pa = priorityConfig(a.priority).sortOrder;
    const pb = priorityConfig(b.priority).sortOrder;
    if (pa !== pb) return pa - pb;
    // Within same priority, sort by deadline (soonest first)
    const da = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
    const db_ = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
    return da - db_;
  });

  // Compute summary stats
  const totalPotentialSavings = activeAlerts.reduce((sum, a) => {
    return sum + (a.metadata?.potentialSavings || 0);
  }, 0);

  const ytdIncome = profitability?.netOperatingIncome || 0;
  const estimatedTaxLiability = ytdIncome > 0 ? ytdIncome * 0.3 : 0;
  const retirementContributions = activeAlerts
    .filter((a) => a.alertType === "retirement_contribution_gap")
    .reduce((sum, a) => sum + ((a.metadata?.contributionsYTD as number) || 0), 0);

  const toggleExpanded = (id: string) => {
    setExpandedAlerts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tax Strategy Alerts</h1>
          <p className="text-muted-foreground">
            Proactive tax planning insights based on your financial data
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Tax Year Selector */}
          <select
            value={taxYear}
            onChange={(e) => setTaxYear(parseInt(e.target.value, 10))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value={currentYear}>{currentYear}</option>
            <option value={currentYear - 1}>{currentYear - 1}</option>
          </select>

          {canWrite && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
            >
              <RefreshCw
                size={14}
                className={regenerateMutation.isPending ? "animate-spin" : ""}
              />
              <span className="ml-1">Regenerate</span>
            </Button>
          )}
        </div>
      </div>

      {/* Advisory Disclaimer - Prominently displayed */}
      <AdvisoryDisclaimer />

      {/* Summary Banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <FileText size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {activeAlerts.length} active alert{activeAlerts.length !== 1 ? "s" : ""} for {taxYear}
                </p>
                {totalPotentialSavings > 0 && (
                  <p className="text-lg font-bold text-green-400">
                    ~{formatFullCurrency(totalPotentialSavings)} in potential tax savings
                  </p>
                )}
              </div>
            </div>
            {dismissedAlerts.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDismissed(!showDismissed)}
              >
                {showDismissed ? (
                  <EyeOff size={14} />
                ) : (
                  <Eye size={14} />
                )}
                <span className="ml-1">
                  {showDismissed ? "Hide" : "Show"} {dismissedAlerts.length} Dismissed
                </span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="YTD Net Operating Income"
          value={isLoading ? "--" : formatCurrency(ytdIncome)}
          icon={DollarSign}
          color="text-green-400"
          subtitle={`${taxYear} year to date`}
        />
        <MetricCard
          title="Estimated Tax Liability"
          value={isLoading ? "--" : formatCurrency(estimatedTaxLiability)}
          icon={Receipt}
          color="text-orange-400"
          subtitle="~30% combined estimated rate"
        />
        <MetricCard
          title="Retirement Contributions"
          value={isLoading ? "--" : formatCurrency(retirementContributions)}
          icon={PiggyBank}
          color="text-blue-400"
          subtitle="Detected from transactions"
        />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-5 w-1/3 bg-muted/30 rounded animate-pulse" />
                  <div className="h-4 w-2/3 bg-muted/30 rounded animate-pulse" />
                  <div className="h-4 w-1/2 bg-muted/30 rounded animate-pulse" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-destructive/50">
          <CardContent className="p-6 text-center">
            <AlertTriangle size={24} className="mx-auto mb-2 text-destructive" />
            <p className="text-sm text-destructive">
              Failed to load tax alerts. Please try again.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && sortedAlerts.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle2
              size={48}
              className="mx-auto mb-4 text-green-400/50"
            />
            <h3 className="text-lg font-medium">No Active Alerts</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {activeAlerts.length === 0 && dismissedAlerts.length > 0
                ? "All alerts have been dismissed. Toggle 'Show Dismissed' to view them."
                : `No tax strategy alerts were generated for ${taxYear}. This may be because there isn't enough financial data yet.`}
            </p>
            {canWrite && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => regenerateMutation.mutate()}
                disabled={regenerateMutation.isPending}
              >
                <RefreshCw
                  size={14}
                  className={
                    regenerateMutation.isPending ? "animate-spin" : ""
                  }
                />
                <span className="ml-1">Generate Alerts</span>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Alert Cards */}
      {!isLoading && sortedAlerts.length > 0 && (
        <div className="space-y-4">
          {sortedAlerts.map((alert) => {
            const config = priorityConfig(alert.priority);
            const PriorityIcon = config.icon;
            const isExpanded = expandedAlerts.has(alert.id);
            const actionItems =
              (alert.metadata?.actionItems as string[]) || [];
            const savings = alert.metadata?.potentialSavings as
              | number
              | undefined;
            const deadline = alert.metadata?.deadline as string | undefined;

            return (
              <Card
                key={alert.id}
                className={cn(
                  "transition-all",
                  alert.isDismissed && "opacity-60"
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                          alert.priority === "high"
                            ? "bg-red-500/10"
                            : alert.priority === "medium"
                              ? "bg-yellow-500/10"
                              : "bg-blue-500/10"
                        )}
                      >
                        <PriorityIcon
                          size={16}
                          className={
                            alert.priority === "high"
                              ? "text-red-400"
                              : alert.priority === "medium"
                                ? "text-yellow-400"
                                : "text-blue-400"
                          }
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base">
                            {alert.title}
                          </CardTitle>
                          <Badge className={cn("text-[10px]", config.color)}>
                            {config.label}
                          </Badge>
                          {savings && savings > 0 && (
                            <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px]">
                              ~{formatFullCurrency(savings)} savings
                            </Badge>
                          )}
                          {alert.isDismissed && (
                            <Badge
                              variant="secondary"
                              className="text-[10px]"
                            >
                              Dismissed
                            </Badge>
                          )}
                        </div>
                        {deadline && (
                          <p
                            className={cn(
                              "text-xs mt-1",
                              deadlineColor(deadline)
                            )}
                          >
                            {deadlineText(deadline)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {canWrite && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => dismissMutation.mutate(alert.id)}
                          disabled={dismissMutation.isPending}
                          title={
                            alert.isDismissed ? "Restore alert" : "Dismiss alert"
                          }
                        >
                          {alert.isDismissed ? (
                            <Eye size={14} />
                          ) : (
                            <EyeOff size={14} />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(alert.id)}
                      >
                        {isExpanded ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">
                    {alert.description}
                  </p>

                  {/* Expanded Action Items */}
                  {isExpanded && actionItems.length > 0 && (
                    <div className="mt-4 space-y-2 border-t border-border pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                        Action Items
                      </p>
                      <ul className="space-y-2">
                        {actionItems.map((item, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm"
                          >
                            <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
                            <span className="text-muted-foreground">
                              {item}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Disclaimer reminder at bottom */}
      <div className="pt-2">
        <AdvisoryDisclaimer />
      </div>
    </div>
  );
}
