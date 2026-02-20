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
import { MetricCard } from "@/components/finance/metric-card";
import { AdvisoryDisclaimer } from "@/components/ui/advisory-disclaimer";
import {
  Target,
  Clock,
  DollarSign,
  TrendingUp,
  PiggyBank,
  Landmark,
  Building2,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Percent,
  Map,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import Link from "next/link";
import type { RetirementProjection } from "@/lib/finance/retirement";

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

// ── Readiness Gauge ─────────────────────────────────────────────────────────

function ReadinessGauge({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 80) return { bg: "bg-green-500", text: "text-green-400", label: "On Track" };
    if (s >= 60) return { bg: "bg-yellow-500", text: "text-yellow-400", label: "Needs Attention" };
    if (s >= 40) return { bg: "bg-orange-500", text: "text-orange-400", label: "At Risk" };
    return { bg: "bg-red-500", text: "text-red-400", label: "Behind" };
  };

  const color = getColor(score);
  const circumference = 2 * Math.PI * 60;
  const dashOffset = circumference - (score / 100) * circumference * 0.75;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 140 140" className="w-full h-full -rotate-[135deg]">
          {/* Background arc */}
          <circle
            cx="70"
            cy="70"
            r="60"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="10"
            strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <circle
            cx="70"
            cy="70"
            r="60"
            fill="none"
            stroke="currentColor"
            className={color.text}
            strokeWidth="10"
            strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${color.text}`}>{score}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
      <span className={`text-sm font-medium mt-2 ${color.text}`}>
        {color.label}
      </span>
    </div>
  );
}

// ── Setup Wizard ────────────────────────────────────────────────────────────

function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    currentAge: "",
    targetRetirementAge: "",
    desiredMonthlyIncome: "",
    socialSecurityEstimate: "",
    otherPensionIncome: "",
    riskTolerance: "moderate",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const riskReturns: Record<string, number> = {
        conservative: 0.05,
        moderate: 0.07,
        aggressive: 0.09,
      };

      const res = await fetch("/api/finance/retirement/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentAge: parseInt(form.currentAge),
          targetRetirementAge: parseInt(form.targetRetirementAge),
          desiredMonthlyIncome: parseFloat(form.desiredMonthlyIncome),
          socialSecurityEstimate:
            parseFloat(form.socialSecurityEstimate) || 0,
          otherPensionIncome: parseFloat(form.otherPensionIncome) || 0,
          riskTolerance: form.riskTolerance,
          inflationRate: 0.03,
          expectedReturnRate: riskReturns[form.riskTolerance] || 0.07,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to save profile");
      }
      return res.json();
    },
    onSuccess: () => {
      onComplete();
    },
  });

  const steps = [
    {
      title: "Your Age",
      description: "How old are you today?",
      content: (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Current Age</label>
            <Input
              type="number"
              placeholder="e.g. 45"
              value={form.currentAge}
              onChange={(e) =>
                setForm({ ...form, currentAge: e.target.value })
              }
              min={18}
              max={100}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">
              Target Retirement Age
            </label>
            <Input
              type="number"
              placeholder="e.g. 65"
              value={form.targetRetirementAge}
              onChange={(e) =>
                setForm({ ...form, targetRetirementAge: e.target.value })
              }
              min={parseInt(form.currentAge) + 1 || 30}
              max={100}
              className="mt-1"
            />
          </div>
        </div>
      ),
      isValid: () =>
        form.currentAge &&
        form.targetRetirementAge &&
        parseInt(form.targetRetirementAge) > parseInt(form.currentAge),
    },
    {
      title: "Desired Income",
      description: "How much monthly income do you need in retirement?",
      content: (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">
              Desired Monthly Income
            </label>
            <div className="relative mt-1">
              <DollarSign
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="number"
                placeholder="e.g. 15000"
                value={form.desiredMonthlyIncome}
                onChange={(e) =>
                  setForm({ ...form, desiredMonthlyIncome: e.target.value })
                }
                className="pl-8"
              />
            </div>
          </div>
        </div>
      ),
      isValid: () =>
        form.desiredMonthlyIncome && parseFloat(form.desiredMonthlyIncome) > 0,
    },
    {
      title: "Other Income Sources",
      description: "Estimate Social Security and pension income (if any).",
      content: (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">
              Estimated Social Security (monthly)
            </label>
            <div className="relative mt-1">
              <DollarSign
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="number"
                placeholder="e.g. 2500"
                value={form.socialSecurityEstimate}
                onChange={(e) =>
                  setForm({
                    ...form,
                    socialSecurityEstimate: e.target.value,
                  })
                }
                className="pl-8"
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">
              Other Pension Income (monthly)
            </label>
            <div className="relative mt-1">
              <DollarSign
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="number"
                placeholder="e.g. 0"
                value={form.otherPensionIncome}
                onChange={(e) =>
                  setForm({ ...form, otherPensionIncome: e.target.value })
                }
                className="pl-8"
              />
            </div>
          </div>
        </div>
      ),
      isValid: () => true,
    },
    {
      title: "Risk Tolerance",
      description: "How aggressively do you want to invest?",
      content: (
        <div className="space-y-3">
          {[
            {
              value: "conservative",
              label: "Conservative",
              desc: "~5% annual return. Focus on capital preservation.",
            },
            {
              value: "moderate",
              label: "Moderate",
              desc: "~7% annual return. Balanced growth and stability.",
            },
            {
              value: "aggressive",
              label: "Aggressive",
              desc: "~9% annual return. Higher growth, more volatility.",
            },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() =>
                setForm({ ...form, riskTolerance: opt.value })
              }
              className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                form.riskTolerance === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-border/80"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {opt.desc}
                  </p>
                </div>
                {form.riskTolerance === opt.value && (
                  <CheckCircle2 size={18} className="text-primary shrink-0" />
                )}
              </div>
            </button>
          ))}
        </div>
      ),
      isValid: () => true,
    },
  ];

  const currentStep = steps[step];

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <Target size={14} />
            <span>
              Step {step + 1} of {steps.length}
            </span>
          </div>
          <CardTitle className="text-lg">{currentStep.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {currentStep.description}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentStep.content}

          {/* Progress dots */}
          <div className="flex justify-center gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === step
                    ? "bg-primary"
                    : i < step
                      ? "bg-primary/40"
                      : "bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(step - 1)}
              disabled={step === 0}
            >
              <ChevronLeft size={14} />
              Back
            </Button>
            {step < steps.length - 1 ? (
              <Button
                size="sm"
                onClick={() => setStep(step + 1)}
                disabled={!currentStep.isValid()}
              >
                Next
                <ChevronRight size={14} />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Saving..." : "Calculate My Plan"}
                <ArrowRight size={14} />
              </Button>
            )}
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-400 text-center">
              {mutation.error.message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Projection Chart ────────────────────────────────────────────────────────

function ProjectionChart({
  scenarios,
}: {
  scenarios: RetirementProjection["scenarios"];
}) {
  if (!scenarios.length || !scenarios[0].yearByYear.length) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
        No projection data available.
      </div>
    );
  }

  // Build unified chart data from the first scenario's years
  const chartData = scenarios[0].yearByYear.map((yp, idx) => {
    const row: Record<string, number> = {
      age: yp.age,
    };
    scenarios.forEach((s) => {
      row[s.name] = s.yearByYear[idx]?.endBalance ?? 0;
    });
    return row;
  });

  const colors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="age"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          label={{
            value: "Age",
            position: "insideBottom",
            offset: -5,
            fontSize: 11,
            fill: "hsl(var(--muted-foreground))",
          }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickFormatter={(v) => formatCurrency(v)}
          width={70}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: 12,
          }}
          formatter={(value: number, name: string) => [
            formatCurrencyFull(value),
            name,
          ]}
          labelFormatter={(label) => `Age ${label}`}
        />
        <Legend />
        {scenarios.map((s, i) => (
          <Area
            key={s.name}
            type="monotone"
            dataKey={s.name}
            stroke={colors[i]}
            fill={colors[i]}
            fillOpacity={0.1}
            strokeWidth={i === 0 ? 2 : 1.5}
            strokeDasharray={i === 0 ? undefined : "5 5"}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Passive Income Gap Chart ────────────────────────────────────────────────

function IncomeGapChart({
  passiveIncome,
}: {
  passiveIncome: RetirementProjection["passiveIncome"];
}) {
  const data = [
    {
      name: "Income",
      desired: passiveIncome.desired,
      socialSecurity: passiveIncome.socialSecurity,
      pension: passiveIncome.pension,
      gap: passiveIncome.gap,
    },
  ];

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} layout="vertical" barSize={20}>
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickFormatter={(v) => formatCurrency(v)}
        />
        <YAxis type="category" dataKey="name" hide />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: 12,
          }}
          formatter={(value: number, name: string) => [
            formatCurrencyFull(value),
            name === "socialSecurity"
              ? "Social Security"
              : name === "pension"
                ? "Pension"
                : name === "gap"
                  ? "Gap (needs funding)"
                  : "Desired",
          ]}
        />
        <Bar
          dataKey="socialSecurity"
          stackId="income"
          fill="hsl(var(--chart-1))"
          name="Social Security"
          radius={[4, 0, 0, 4]}
        />
        <Bar
          dataKey="pension"
          stackId="income"
          fill="hsl(var(--chart-2))"
          name="Pension"
        />
        <Bar
          dataKey="gap"
          stackId="income"
          fill="hsl(var(--chart-4))"
          name="Gap"
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Scenario Card ───────────────────────────────────────────────────────────

function ScenarioCard({
  scenario,
  requiredNestEgg,
  isActive,
}: {
  scenario: RetirementProjection["scenarios"][0];
  requiredNestEgg: number;
  isActive: boolean;
}) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return "text-green-400";
    if (s >= 60) return "text-yellow-400";
    if (s >= 40) return "text-orange-400";
    return "text-red-400";
  };

  return (
    <Card
      className={isActive ? "border-primary/40 bg-primary/5" : ""}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            {scenario.name}
          </CardTitle>
          <span
            className={`text-lg font-bold ${getScoreColor(scenario.readinessScore)}`}
          >
            {scenario.readinessScore}%
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{scenario.description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Projected Balance</span>
          <span className="font-medium">
            {formatCurrencyFull(scenario.projectedBalance)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Required</span>
          <span className="font-medium">
            {formatCurrencyFull(requiredNestEgg)}
          </span>
        </div>
        {scenario.includePracticeSale && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Practice Sale</span>
            <span className="font-medium text-blue-400">
              +{formatCurrencyFull(scenario.practiceSaleProceeds)}
            </span>
          </div>
        )}
        <div className="flex justify-between text-sm border-t border-border pt-2">
          <span className="text-muted-foreground">
            {scenario.projectedBalance >= requiredNestEgg
              ? "Surplus"
              : "Shortfall"}
          </span>
          <span
            className={`font-medium ${scenario.projectedBalance >= requiredNestEgg ? "text-green-400" : "text-red-400"}`}
          >
            {scenario.projectedBalance >= requiredNestEgg ? "+" : "-"}
            {formatCurrencyFull(
              Math.abs(scenario.projectedBalance - requiredNestEgg)
            )}
          </span>
        </div>

        {/* Progress bar */}
        <div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                scenario.readinessScore >= 80
                  ? "bg-green-500"
                  : scenario.readinessScore >= 60
                    ? "bg-yellow-500"
                    : scenario.readinessScore >= 40
                      ? "bg-orange-500"
                      : "bg-red-500"
              }`}
              style={{ width: `${Math.min(100, scenario.readinessScore)}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function RetirementPage() {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    error,
  } = useQuery<{
    hasProfile: boolean;
    projection: RetirementProjection | null;
  }>({
    queryKey: ["retirement-projection"],
    queryFn: async () => {
      const res = await fetch("/api/finance/retirement");
      if (!res.ok) throw new Error("Failed to load retirement data");
      return res.json();
    },
  });

  const handleProfileComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["retirement-projection"] });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Retirement Planning</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 bg-muted/30 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Retirement Planning</h1>
        </div>
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4">
            <p className="text-sm text-red-400">
              Failed to load retirement data. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Setup wizard if no profile
  if (!data?.hasProfile || !data?.projection) {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Retirement Planning</h1>
          <p className="text-muted-foreground mt-1">
            Set up your retirement profile to see personalized projections
          </p>
        </div>
        <SetupWizard onComplete={handleProfileComplete} />
        <AdvisoryDisclaimer />
      </div>
    );
  }

  const proj = data.projection;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Retirement Planning</h1>
          <p className="text-muted-foreground">
            Personalized projections based on your financial profile
          </p>
        </div>
        <Link href="/finance/retirement/roadmap">
          <Button variant="outline" size="sm">
            <Map size={14} />
            <span className="ml-1">View Roadmap</span>
          </Button>
        </Link>
      </div>

      {/* Readiness Score + Income Gap */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Readiness Score */}
        <Card className="bg-gradient-to-br from-card to-card/80 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Retirement Readiness</CardTitle>
            <p className="text-xs text-muted-foreground">
              Based on current savings pace vs. required nest egg
            </p>
          </CardHeader>
          <CardContent className="flex justify-center py-4">
            <ReadinessGauge score={proj.readinessScore} />
          </CardContent>
        </Card>

        {/* Passive Income Gap */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Monthly Income Gap</CardTitle>
            <p className="text-xs text-muted-foreground">
              Desired: {formatCurrencyFull(proj.passiveIncome.desired)}/mo
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <IncomeGapChart passiveIncome={proj.passiveIncome} />
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Social Security</p>
                <p className="text-sm font-medium">
                  {formatCurrencyFull(proj.passiveIncome.socialSecurity)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pension</p>
                <p className="text-sm font-medium">
                  {formatCurrencyFull(proj.passiveIncome.pension)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gap to Fund</p>
                <p className="text-sm font-medium text-red-400">
                  {formatCurrencyFull(proj.passiveIncome.gap)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Years to Retirement"
          value={`${proj.yearsToRetirement} yrs`}
          icon={Clock}
          color="text-blue-400"
          subtitle={`Target: Age ${proj.profile.targetRetirementAge}`}
        />
        <MetricCard
          title="Required Nest Egg"
          value={formatCurrency(proj.requiredNestEgg)}
          icon={Target}
          color="text-amber-400"
          subtitle={`At ${(proj.profile.inflationRate * 100).toFixed(0)}% inflation`}
        />
        <MetricCard
          title="Current Progress"
          value={`${proj.keyMetrics.progressPercent}%`}
          icon={Percent}
          color={
            proj.keyMetrics.progressPercent >= 50
              ? "text-green-400"
              : "text-orange-400"
          }
          subtitle={`${formatCurrencyFull(proj.currentRetirementBalance)} saved`}
        />
        <MetricCard
          title="Monthly Shortfall"
          value={
            proj.keyMetrics.monthlyShortfall > 0
              ? formatCurrency(proj.keyMetrics.monthlyShortfall)
              : "$0"
          }
          icon={PiggyBank}
          color={
            proj.keyMetrics.monthlyShortfall === 0
              ? "text-green-400"
              : "text-red-400"
          }
          subtitle={
            proj.keyMetrics.monthlyShortfall > 0
              ? "Additional savings needed/mo"
              : "On track!"
          }
        />
      </div>

      {/* Financial Context */}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Current Net Worth"
          value={formatCurrency(proj.currentNetWorth)}
          icon={DollarSign}
          color="text-green-400"
          subtitle="Total assets minus liabilities"
        />
        <MetricCard
          title="Practice Value"
          value={formatCurrency(proj.practiceValue)}
          icon={Building2}
          color="text-purple-400"
          subtitle="Blended valuation estimate"
        />
        <MetricCard
          title="Retirement Savings"
          value={formatCurrency(proj.currentRetirementBalance)}
          icon={Landmark}
          color="text-blue-400"
          subtitle="401k, IRA, and retirement accounts"
        />
      </div>

      {/* Year-by-Year Projection */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">
              Retirement Balance Projection
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Projected growth across three scenarios to age{" "}
              {proj.profile.targetRetirementAge}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Expected Return</p>
            <p className="text-sm font-medium">
              {(proj.profile.expectedReturnRate * 100).toFixed(0)}%/yr
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <ProjectionChart scenarios={proj.scenarios} />
        </CardContent>
      </Card>

      {/* Three Scenarios */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Scenarios</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {proj.scenarios.map((scenario, idx) => (
            <ScenarioCard
              key={scenario.name}
              scenario={scenario}
              requiredNestEgg={proj.requiredNestEgg}
              isActive={idx === 0}
            />
          ))}
        </div>
      </div>

      {/* Assumptions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assumptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 text-sm">
            <div>
              <p className="text-muted-foreground">Inflation Rate</p>
              <p className="font-medium">
                {(proj.profile.inflationRate * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Expected Return</p>
              <p className="font-medium">
                {(proj.profile.expectedReturnRate * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Safe Withdrawal Rate</p>
              <p className="font-medium">4.0%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Risk Tolerance</p>
              <p className="font-medium capitalize">
                {proj.profile.riskTolerance}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Practice sale scenario assumes 70% of current estimated value after
            broker fees, taxes, and transition costs.
          </p>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <AdvisoryDisclaimer />
    </div>
  );
}
