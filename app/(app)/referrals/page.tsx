"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdvisoryDisclaimer } from "@/components/ui/advisory-disclaimer";
import { MetricCard } from "@/components/finance/metric-card";
import { usePermissions } from "@/lib/hooks/use-permissions";
import {
  Handshake,
  RefreshCw,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Landmark,
  Shield,
  Calculator,
  Building2,
  Wrench,
  PiggyBank,
  CreditCard,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface OpportunityRecord {
  id: string;
  practiceId: string;
  opportunityType: string;
  title: string;
  description: string;
  estimatedSavings: string | null;
  estimatedValue: string | null;
  priority: string;
  status: string;
  matchedPartnerId: string | null;
  referredAt: string | null;
  completedAt: string | null;
  dismissedAt: string | null;
  metadata: Record<string, unknown> | null;
  expiresAt: string | null;
  createdAt: string;
}

interface PartnerRecord {
  id: string;
  name: string;
  category: string;
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
}

interface HistoryRecord {
  id: string;
  opportunityType: string;
  title: string;
  description: string;
  estimatedSavings: string | null;
  status: string;
  referredAt: string | null;
  completedAt: string | null;
  partnerName: string | null;
  partnerCategory: string | null;
  partnerEmail: string | null;
  partnerWebsite: string | null;
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

const typeIcons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  loan_refinance: Landmark,
  insurance_review: Shield,
  tax_planning: Calculator,
  exit_planning: Building2,
  equipment_financing: Wrench,
  financial_advisor: PiggyBank,
  debt_consolidation: CreditCard,
};

const typeLabels: Record<string, string> = {
  loan_refinance: "Loan Refinance",
  insurance_review: "Insurance Review",
  tax_planning: "Tax Planning",
  exit_planning: "Exit Planning",
  equipment_financing: "Equipment Financing",
  financial_advisor: "Financial Advisor",
  debt_consolidation: "Debt Consolidation",
};

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
        label: "Medium",
        sortOrder: 1,
      };
    case "low":
      return {
        color: "bg-blue-500/15 text-blue-400 border-blue-500/30",
        icon: FileText,
        label: "Low",
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

function statusBadge(status: string) {
  switch (status) {
    case "detected":
      return { color: "bg-blue-500/15 text-blue-400 border-blue-500/30", label: "New" };
    case "viewed":
      return { color: "bg-slate-500/15 text-slate-400 border-slate-500/30", label: "Viewed" };
    case "referred":
      return { color: "bg-purple-500/15 text-purple-400 border-purple-500/30", label: "Referred" };
    case "completed":
      return { color: "bg-green-500/15 text-green-400 border-green-500/30", label: "Completed" };
    case "dismissed":
      return { color: "bg-muted text-muted-foreground border-muted", label: "Dismissed" };
    default:
      return { color: "bg-muted text-muted-foreground", label: status };
  }
}

export default function ReferralsPage() {
  const queryClient = useQueryClient();
  const { canWrite } = usePermissions();
  const [showDismissed, setShowDismissed] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // Fetch opportunities
  const { data: oppData, isLoading, error } = useQuery({
    queryKey: ["referralOpportunities"],
    queryFn: async () => {
      const res = await fetch("/api/referrals/opportunities");
      if (!res.ok) throw new Error("Failed to load opportunities");
      return res.json() as Promise<{ opportunities: OpportunityRecord[] }>;
    },
  });

  // Fetch history
  const { data: historyData } = useQuery({
    queryKey: ["referralHistory"],
    queryFn: async () => {
      const res = await fetch("/api/referrals/history");
      if (!res.ok) throw new Error("Failed to load history");
      return res.json() as Promise<{ history: HistoryRecord[] }>;
    },
  });

  // Fetch partners
  const { data: partnerData } = useQuery({
    queryKey: ["referralPartners"],
    queryFn: async () => {
      const res = await fetch("/api/referrals/partners");
      if (!res.ok) throw new Error("Failed to load partners");
      return res.json() as Promise<{ partners: PartnerRecord[] }>;
    },
  });

  // Detect mutation
  const detectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/referrals/opportunities/detect", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to detect opportunities");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referralOpportunities"] });
      queryClient.invalidateQueries({ queryKey: ["referralHistory"] });
    },
  });

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/referrals/opportunities/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referralOpportunities"] });
      queryClient.invalidateQueries({ queryKey: ["referralHistory"] });
    },
  });

  // Refer mutation
  const referMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/referrals/opportunities/${id}/refer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to create referral");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referralOpportunities"] });
      queryClient.invalidateQueries({ queryKey: ["referralHistory"] });
    },
  });

  const opportunities = oppData?.opportunities || [];
  const _history = historyData?.history || [];
  const partners = partnerData?.partners || [];

  const activeOpportunities = opportunities.filter(
    (o) => o.status !== "dismissed" && o.status !== "completed" && o.status !== "referred"
  );
  const referredOpportunities = opportunities.filter((o) => o.status === "referred");
  const dismissedOpportunities = opportunities.filter((o) => o.status === "dismissed");
  const completedOpportunities = opportunities.filter((o) => o.status === "completed");

  const displayOpportunities = showDismissed
    ? [...activeOpportunities, ...dismissedOpportunities]
    : activeOpportunities;

  // Sort by priority: high -> medium -> low
  const sortedOpportunities = [...displayOpportunities].sort((a, b) => {
    const pa = priorityConfig(a.priority).sortOrder;
    const pb = priorityConfig(b.priority).sortOrder;
    return pa - pb;
  });

  // Compute summary stats
  const totalEstimatedSavings = activeOpportunities.reduce((sum, o) => {
    return sum + (o.estimatedSavings ? parseFloat(o.estimatedSavings) : 0);
  }, 0);

  const completedSavings = completedOpportunities.reduce((sum, o) => {
    return sum + (o.estimatedSavings ? parseFloat(o.estimatedSavings) : 0);
  }, 0);

  const toggleExpanded = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getPartnerForOpportunity = (opp: OpportunityRecord) => {
    if (!opp.matchedPartnerId) return null;
    return partners.find((p) => p.id === opp.matchedPartnerId) || null;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Referral Marketplace</h1>
          <p className="text-muted-foreground">
            Smart financial opportunities detected from your data
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canWrite && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => detectMutation.mutate()}
              disabled={detectMutation.isPending}
            >
              <RefreshCw
                size={14}
                className={detectMutation.isPending ? "animate-spin" : ""}
              />
              <span className="ml-1">Scan for Opportunities</span>
            </Button>
          )}
        </div>
      </div>

      {/* Advisory Disclaimer */}
      <AdvisoryDisclaimer />

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Active Opportunities"
          value={isLoading ? "--" : String(activeOpportunities.length)}
          icon={TrendingUp}
          color="text-blue-400"
          subtitle="Detected from your financial data"
        />
        <MetricCard
          title="Estimated Savings"
          value={isLoading ? "--" : formatCurrency(totalEstimatedSavings)}
          icon={DollarSign}
          color="text-green-400"
          subtitle="From active opportunities"
        />
        <MetricCard
          title="Savings Realized"
          value={isLoading ? "--" : formatCurrency(completedSavings)}
          icon={CheckCircle2}
          color="text-emerald-400"
          subtitle="From completed referrals"
        />
      </div>

      {/* Active Referrals Section */}
      {referredOpportunities.length > 0 && (
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Handshake size={18} className="text-purple-400" />
              Active Referrals ({referredOpportunities.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {referredOpportunities.map((opp) => {
              const partner = getPartnerForOpportunity(opp);
              return (
                <div
                  key={opp.id}
                  className="flex items-center justify-between rounded-md border border-purple-500/20 bg-background/50 px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{opp.title}</p>
                    {partner && (
                      <p className="text-xs text-muted-foreground">
                        Partner: {partner.name}
                        {partner.contactEmail && ` - ${partner.contactEmail}`}
                      </p>
                    )}
                    {opp.referredAt && (
                      <p className="text-xs text-muted-foreground">
                        Referred{" "}
                        {new Date(opp.referredAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {opp.estimatedSavings && (
                      <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px]">
                        ~{formatFullCurrency(parseFloat(opp.estimatedSavings))} savings
                      </Badge>
                    )}
                    {canWrite && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateStatusMutation.mutate({
                            id: opp.id,
                            status: "completed",
                          })
                        }
                        disabled={updateStatusMutation.isPending}
                      >
                        <CheckCircle2 size={14} />
                        <span className="ml-1">Mark Complete</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Summary Banner */}
      {!isLoading && activeOpportunities.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <TrendingUp size={20} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {activeOpportunities.length} opportunity
                    {activeOpportunities.length !== 1 ? "ies" : "y"} detected
                  </p>
                  {totalEstimatedSavings > 0 && (
                    <p className="text-lg font-bold text-green-400">
                      ~{formatFullCurrency(totalEstimatedSavings)} in estimated savings
                    </p>
                  )}
                </div>
              </div>
              {dismissedOpportunities.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDismissed(!showDismissed)}
                >
                  {showDismissed ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span className="ml-1">
                    {showDismissed ? "Hide" : "Show"} {dismissedOpportunities.length}{" "}
                    Dismissed
                  </span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
              Failed to load opportunities. Please try again.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && sortedOpportunities.length === 0 && referredOpportunities.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Handshake size={48} className="mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-medium">No Opportunities Detected</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Run a scan to detect financial opportunities based on your
              transactions, loans, and financial data.
            </p>
            {canWrite && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => detectMutation.mutate()}
                disabled={detectMutation.isPending}
              >
                <RefreshCw
                  size={14}
                  className={detectMutation.isPending ? "animate-spin" : ""}
                />
                <span className="ml-1">Scan for Opportunities</span>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Opportunity Cards */}
      {!isLoading && sortedOpportunities.length > 0 && (
        <div className="space-y-4">
          {sortedOpportunities.map((opp) => {
            const config = priorityConfig(opp.priority);
            const TypeIcon = typeIcons[opp.opportunityType] || FileText;
            const isExpanded = expandedCards.has(opp.id);
            const savings = opp.estimatedSavings
              ? parseFloat(opp.estimatedSavings)
              : null;
            const value = opp.estimatedValue
              ? parseFloat(opp.estimatedValue)
              : null;
            const partner = getPartnerForOpportunity(opp);
            const stBadge = statusBadge(opp.status);

            return (
              <Card
                key={opp.id}
                className={cn(
                  "transition-all",
                  opp.status === "dismissed" && "opacity-60"
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                          opp.priority === "high"
                            ? "bg-red-500/10"
                            : opp.priority === "medium"
                              ? "bg-yellow-500/10"
                              : "bg-blue-500/10"
                        )}
                      >
                        <TypeIcon
                          size={16}
                          className={
                            opp.priority === "high"
                              ? "text-red-400"
                              : opp.priority === "medium"
                                ? "text-yellow-400"
                                : "text-blue-400"
                          }
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base">
                            {opp.title}
                          </CardTitle>
                          <Badge className={cn("text-[10px]", config.color)}>
                            {config.label}
                          </Badge>
                          <Badge className={cn("text-[10px]", stBadge.color)}>
                            {stBadge.label}
                          </Badge>
                          {savings && savings > 0 && (
                            <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px]">
                              ~{formatFullCurrency(savings)} savings
                            </Badge>
                          )}
                          {value && value > 0 && !savings && (
                            <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px]">
                              ~{formatFullCurrency(value)} value
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {typeLabels[opp.opportunityType] || opp.opportunityType}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {canWrite && opp.status !== "dismissed" && opp.status !== "referred" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            updateStatusMutation.mutate({
                              id: opp.id,
                              status: "dismissed",
                            })
                          }
                          disabled={updateStatusMutation.isPending}
                          title="Dismiss"
                        >
                          <XCircle size={14} />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(opp.id)}
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
                    {opp.description}
                  </p>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-4 space-y-4 border-t border-border pt-4">
                      {/* Partner Info */}
                      {partner && (
                        <div className="rounded-md border border-border bg-muted/30 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
                            Matched Partner
                          </p>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">
                                {partner.name}
                              </p>
                              {partner.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {partner.description}
                                </p>
                              )}
                              {partner.contactEmail && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {partner.contactEmail}
                                </p>
                              )}
                            </div>
                            {partner.website && (
                              <Button variant="ghost" size="sm" asChild>
                                <a
                                  href={partner.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink size={14} />
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Connect Button */}
                      {canWrite && opp.status !== "dismissed" && opp.status !== "referred" && (
                        <Button
                          size="sm"
                          onClick={() => referMutation.mutate(opp.id)}
                          disabled={referMutation.isPending}
                        >
                          <ArrowRight size={14} />
                          <span className="ml-1">Connect with Partner</span>
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* How This Works */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setShowHowItWorks(!showHowItWorks)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <HelpCircle size={18} className="text-muted-foreground" />
              How This Works
            </CardTitle>
            {showHowItWorks ? (
              <ChevronUp size={16} className="text-muted-foreground" />
            ) : (
              <ChevronDown size={16} className="text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {showHowItWorks && (
          <CardContent className="pt-0 space-y-3 text-sm text-muted-foreground">
            <p>
              The Referral Marketplace analyzes your financial data to detect
              opportunities where you could save money or improve your financial
              position. Here is how it works:
            </p>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                <strong>Automatic Detection:</strong> We scan your transactions,
                loans, insurance spending, tax situation, and net worth to find
                actionable opportunities.
              </li>
              <li>
                <strong>Partner Matching:</strong> Each opportunity is matched
                with a vetted partner who specializes in that area (lenders,
                insurance brokers, CPAs, financial advisors, etc.).
              </li>
              <li>
                <strong>You Decide:</strong> Review each opportunity, dismiss
                what does not apply, and connect with partners for the ones that
                interest you. There is no obligation.
              </li>
              <li>
                <strong>Track Results:</strong> Mark referrals as complete to
                track your realized savings over time.
              </li>
            </ol>
            <p className="text-xs">
              Opportunity detection runs on your data locally. No financial data
              is shared with partners until you explicitly choose to connect.
            </p>
          </CardContent>
        )}
      </Card>

      {/* Disclaimer at bottom */}
      <div className="pt-2">
        <AdvisoryDisclaimer />
      </div>
    </div>
  );
}
