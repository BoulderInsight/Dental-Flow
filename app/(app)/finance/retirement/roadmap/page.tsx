"use client";

import { useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdvisoryDisclaimer } from "@/components/ui/advisory-disclaimer";
import {
  ArrowLeft,
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  DollarSign,
  TrendingUp,
  Landmark,
  Wallet,
  Building2,
  Shield,
  Zap,
  Target,
  X,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import type { RetirementRoadmap, RoadmapSuggestion, Milestone } from "@/lib/finance/retirement-roadmap";

// ── Formatting Helpers ──────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(n) >= 1_000) {
    return `$${(n / 1_000).toFixed(0)}k`;
  }
  return `$${n.toFixed(0)}`;
}

function formatCurrencyFull(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

// ── Suggestion Card ─────────────────────────────────────────────────────────

function SuggestionCategoryIcon({
  category,
}: {
  category: RoadmapSuggestion["category"];
}) {
  switch (category) {
    case "savings":
      return <Wallet size={16} className="text-green-400" />;
    case "debt":
      return <Shield size={16} className="text-red-400" />;
    case "investment":
      return <TrendingUp size={16} className="text-blue-400" />;
    case "practice":
      return <Building2 size={16} className="text-purple-400" />;
    case "income":
      return <DollarSign size={16} className="text-amber-400" />;
  }
}

function ImpactBadge({ impact }: { impact: RoadmapSuggestion["impact"] }) {
  const styles = {
    high: "bg-green-500/10 text-green-400",
    medium: "bg-yellow-500/10 text-yellow-400",
    low: "bg-muted text-muted-foreground",
  };

  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[impact]}`}
    >
      {impact.charAt(0).toUpperCase() + impact.slice(1)} Impact
    </span>
  );
}

function SuggestionCard({ suggestion }: { suggestion: RoadmapSuggestion }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <SuggestionCategoryIcon category={suggestion.category} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{suggestion.title}</p>
              <ImpactBadge impact={suggestion.impact} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {suggestion.description}
            </p>
            <div className="flex items-center gap-4 mt-2">
              {suggestion.estimatedMonthlyImpact > 0 && (
                <span className="text-xs text-muted-foreground">
                  {formatCurrencyFull(suggestion.estimatedMonthlyImpact)}/mo
                </span>
              )}
              {suggestion.estimatedAnnualImpact > 0 && (
                <span className="text-xs text-muted-foreground">
                  {formatCurrencyFull(suggestion.estimatedAnnualImpact)}/yr
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Milestone Timeline ──────────────────────────────────────────────────────

const MILESTONE_CATEGORIES = [
  "savings",
  "debt_payoff",
  "investment",
  "practice_sale",
  "income",
  "lifestyle",
  "other",
];

function MilestoneItem({
  milestone,
  onToggle,
  onDelete,
}: {
  milestone: Milestone;
  onToggle: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  const isCompleted = milestone.status === "completed";

  return (
    <div className="flex items-start gap-3 group">
      <button
        onClick={() =>
          onToggle(milestone.id, isCompleted ? "planned" : "completed")
        }
        className="mt-0.5 shrink-0"
      >
        {isCompleted ? (
          <CheckCircle2 size={18} className="text-green-400" />
        ) : (
          <Circle
            size={18}
            className="text-muted-foreground hover:text-primary transition-colors"
          />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p
            className={`text-sm font-medium ${isCompleted ? "line-through text-muted-foreground" : ""}`}
          >
            {milestone.title}
          </p>
          <button
            onClick={() => onDelete(milestone.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2
              size={14}
              className="text-muted-foreground hover:text-red-400"
            />
          </button>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {milestone.targetDate && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock size={10} />
              {new Date(milestone.targetDate + "T00:00:00").toLocaleDateString(
                "en-US",
                { month: "short", year: "numeric" }
              )}
            </span>
          )}
          {milestone.estimatedCost && milestone.estimatedCost > 0 && (
            <span className="text-xs text-muted-foreground">
              Cost: {formatCurrencyFull(milestone.estimatedCost)}
            </span>
          )}
          {milestone.estimatedMonthlyIncome &&
            milestone.estimatedMonthlyIncome > 0 && (
              <span className="text-xs text-green-400">
                +{formatCurrencyFull(milestone.estimatedMonthlyIncome)}/mo
              </span>
            )}
          <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
            {milestone.category}
          </span>
        </div>
        {milestone.notes && (
          <p className="text-xs text-muted-foreground mt-1 italic">
            {milestone.notes}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Add Milestone Form ──────────────────────────────────────────────────────

function AddMilestoneForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    targetDate: "",
    estimatedCost: "",
    estimatedMonthlyIncome: "",
    category: "savings",
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/finance/retirement/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          targetDate: form.targetDate || null,
          estimatedCost: form.estimatedCost
            ? parseFloat(form.estimatedCost)
            : null,
          estimatedMonthlyIncome: form.estimatedMonthlyIncome
            ? parseFloat(form.estimatedMonthlyIncome)
            : null,
          category: form.category,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create milestone");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retirement-roadmap"] });
      onClose();
    },
  });

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Add Milestone</CardTitle>
          <button onClick={onClose}>
            <X size={16} className="text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Title</label>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Max out 401(k)"
            className="mt-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Target Date</label>
            <Input
              type="date"
              value={form.targetDate}
              onChange={(e) =>
                setForm({ ...form, targetDate: e.target.value })
              }
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Category</label>
            <select
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value })
              }
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {MILESTONE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">
              Estimated Cost
            </label>
            <Input
              type="number"
              value={form.estimatedCost}
              onChange={(e) =>
                setForm({ ...form, estimatedCost: e.target.value })
              }
              placeholder="0"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">
              Monthly Income
            </label>
            <Input
              type="number"
              value={form.estimatedMonthlyIncome}
              onChange={(e) =>
                setForm({
                  ...form,
                  estimatedMonthlyIncome: e.target.value,
                })
              }
              placeholder="0"
              className="mt-1"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Notes</label>
          <Input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Optional notes"
            className="mt-1"
          />
        </div>
        <Button
          size="sm"
          className="w-full"
          onClick={() => mutation.mutate()}
          disabled={!form.title || mutation.isPending}
        >
          {mutation.isPending ? "Saving..." : "Add Milestone"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function RetirementRoadmapPage() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: roadmap, isLoading, error } = useQuery<RetirementRoadmap>({
    queryKey: ["retirement-roadmap"],
    queryFn: async () => {
      const res = await fetch("/api/finance/retirement/roadmap");
      if (!res.ok) {
        if (res.status === 404) throw new Error("NO_PROFILE");
        throw new Error("Failed to load roadmap");
      }
      return res.json();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: string;
    }) => {
      const res = await fetch(`/api/finance/retirement/milestones/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update milestone");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retirement-roadmap"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/finance/retirement/milestones/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete milestone");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retirement-roadmap"] });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Retirement Roadmap</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (error?.message === "NO_PROFILE") {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Retirement Roadmap</h1>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <Target size={40} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Set up your retirement profile first to see your personalized
              roadmap.
            </p>
            <Link href="/finance/retirement">
              <Button size="sm" className="mt-4">
                Set Up Profile
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !roadmap) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Retirement Roadmap</h1>
        </div>
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4">
            <p className="text-sm text-red-400">
              Failed to load roadmap data. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const completedCount = roadmap.milestones.filter(
    (m) => m.status === "completed"
  ).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/finance/retirement">
              <Button variant="ghost" size="sm" className="h-7 px-2">
                <ArrowLeft size={14} />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Retirement Roadmap</h1>
          </div>
          <p className="text-muted-foreground">
            Action items and milestones to reach your retirement goals
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Excess Monthly Cash</p>
            <p className="text-xl font-bold text-green-400">
              {formatCurrency(roadmap.summary.excessMonthlyCash)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Debt</p>
            <p className="text-xl font-bold text-red-400">
              {formatCurrency(roadmap.summary.totalDebt)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Practice Value</p>
            <p className="text-xl font-bold text-purple-400">
              {formatCurrency(roadmap.summary.practiceValue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Net Worth</p>
            <p className="text-xl font-bold text-blue-400">
              {formatCurrency(roadmap.summary.currentNetWorth)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Suggested Actions */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap size={18} className="text-amber-400" />
          <h2 className="text-lg font-semibold">Suggested Actions</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {roadmap.suggestions.map((suggestion) => (
            <SuggestionCard key={suggestion.id} suggestion={suggestion} />
          ))}
        </div>
      </div>

      {/* Milestones */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-primary" />
            <h2 className="text-lg font-semibold">Milestones</h2>
            {roadmap.milestones.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {completedCount}/{roadmap.milestones.length} completed
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(true)}
          >
            <Plus size={14} />
            <span className="ml-1">Add</span>
          </Button>
        </div>

        {showAddForm && (
          <div className="mb-4">
            <AddMilestoneForm onClose={() => setShowAddForm(false)} />
          </div>
        )}

        {roadmap.milestones.length === 0 && !showAddForm ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Landmark
                size={36}
                className="mx-auto text-muted-foreground mb-3"
              />
              <p className="text-sm text-muted-foreground">
                No milestones yet. Add milestones to track your progress toward
                retirement goals.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setShowAddForm(true)}
              >
                <Plus size={14} />
                <span className="ml-1">Add First Milestone</span>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4 space-y-4">
              {/* Progress bar */}
              {roadmap.milestones.length > 0 && (
                <div className="mb-2">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          roadmap.milestones.length > 0
                            ? (completedCount / roadmap.milestones.length) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {roadmap.milestones.map((milestone) => (
                <MilestoneItem
                  key={milestone.id}
                  milestone={milestone}
                  onToggle={(id, status) =>
                    toggleMutation.mutate({ id, status })
                  }
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Disclaimer */}
      <AdvisoryDisclaimer />
    </div>
  );
}
