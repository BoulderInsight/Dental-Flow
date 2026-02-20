"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Download, Save, Wand2 } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface BudgetCategory {
  accountRef: string;
  monthlyTarget: number;
}

interface SuggestedCategory {
  accountRef: string;
  suggested: number;
  avgMonthly: number;
}

interface BudgetVsActualRow {
  accountRef: string;
  monthlyTarget: number;
  monthlyActual: number;
  ytdTarget: number;
  ytdActual: number;
  variance: number;
  variancePercent: number;
  status: "under" | "on_track" | "over";
}

export default function BudgetPage() {
  const queryClient = useQueryClient();
  const year = new Date().getFullYear();
  const [editMode, setEditMode] = useState(false);
  const [targets, setTargets] = useState<BudgetCategory[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const { data, isLoading } = useQuery({
    queryKey: ["budget", year, selectedMonth],
    queryFn: async () => {
      const res = await fetch(
        `/api/finance/budget?year=${year}&month=${selectedMonth}`
      );
      if (!res.ok) throw new Error("Failed to load budget");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (cats: BudgetCategory[]) => {
      const res = await fetch("/api/finance/budget", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, categories: cats }),
      });
      if (!res.ok) throw new Error("Failed to save budget");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget"] });
      setEditMode(false);
    },
  });

  const hasBudget = !!data?.budget;
  const suggested: SuggestedCategory[] = data?.suggested?.categories || [];
  const vsActual: BudgetVsActualRow[] = data?.vsActual?.categories || [];

  // Initialize edit targets from budget or suggested
  useEffect(() => {
    if (hasBudget && data.budget.categories) {
      setTargets(
        data.budget.categories.map((c: { accountRef: string; monthlyTarget: number }) => ({
          accountRef: c.accountRef,
          monthlyTarget: c.monthlyTarget,
        }))
      );
    } else if (suggested.length > 0) {
      setTargets(
        suggested.map((s) => ({
          accountRef: s.accountRef,
          monthlyTarget: s.suggested,
        }))
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, hasBudget, suggested.length]);

  function handleUseSuggested() {
    setTargets(
      suggested.map((s) => ({
        accountRef: s.accountRef,
        monthlyTarget: s.suggested,
      }))
    );
    setEditMode(true);
  }

  function updateTarget(accountRef: string, value: number) {
    setTargets((prev) =>
      prev.map((t) =>
        t.accountRef === accountRef ? { ...t, monthlyTarget: value } : t
      )
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Budget Builder</h1>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // First-time setup wizard
  if (!hasBudget) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Set Up Your Budget</h1>
        <p className="text-muted-foreground">
          Based on your last 3 months, here&apos;s a suggested monthly budget.
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Suggested Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-muted">
                    <th className="text-left py-2 font-medium">Category</th>
                    <th className="text-right py-2 font-medium">Avg Monthly</th>
                    <th className="text-right py-2 font-medium">Your Target</th>
                    <th className="text-right py-2 font-medium">Annual</th>
                  </tr>
                </thead>
                <tbody>
                  {targets.map((t) => (
                    <tr key={t.accountRef} className="border-b border-muted/50">
                      <td className="py-2">{t.accountRef}</td>
                      <td className="py-2 text-right text-muted-foreground">
                        ${suggested.find((s) => s.accountRef === t.accountRef)?.avgMonthly.toLocaleString() || "0"}
                      </td>
                      <td className="py-2 text-right">
                        <Input
                          type="number"
                          value={t.monthlyTarget}
                          onChange={(e) =>
                            updateTarget(t.accountRef, parseFloat(e.target.value) || 0)
                          }
                          className="w-28 ml-auto text-right h-8"
                        />
                      </td>
                      <td className="py-2 text-right text-muted-foreground">
                        ${(t.monthlyTarget * 12).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-muted">
              <Button variant="outline" size="sm" onClick={handleUseSuggested}>
                <Wand2 size={14} className="mr-1" />
                Use Suggested
              </Button>
              <Button
                size="sm"
                onClick={() => saveMutation.mutate(targets)}
                disabled={saveMutation.isPending}
              >
                <Save size={14} className="mr-1" />
                Save Budget
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Budget vs Actual view
  const totalTarget = data.vsActual?.totalTarget || 0;
  const totalActual = data.vsActual?.totalActual || 0;
  const totalVariance = data.vsActual?.totalVariance || 0;

  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budget vs Actual</h1>
          <p className="text-muted-foreground">{year} budget tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/api/export/report?type=budget&format=csv">
            <Button variant="outline" size="sm">
              <Download size={14} className="mr-1" />
              Export
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditMode(!editMode)}
          >
            {editMode ? "Cancel" : "Edit Targets"}
          </Button>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {months.map((m, i) => (
          <Button
            key={m}
            variant={selectedMonth === i + 1 ? "default" : "ghost"}
            size="sm"
            className="shrink-0"
            onClick={() => setSelectedMonth(i + 1)}
          >
            {m}
          </Button>
        ))}
      </div>

      {/* Edit mode */}
      {editMode ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit Budget Targets</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-muted">
                  <th className="text-left py-2">Category</th>
                  <th className="text-right py-2">Monthly Target</th>
                </tr>
              </thead>
              <tbody>
                {targets.map((t) => (
                  <tr key={t.accountRef} className="border-b border-muted/50">
                    <td className="py-2">{t.accountRef}</td>
                    <td className="py-2 text-right">
                      <Input
                        type="number"
                        value={t.monthlyTarget}
                        onChange={(e) =>
                          updateTarget(
                            t.accountRef,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-28 ml-auto text-right h-8"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end mt-4">
              <Button
                size="sm"
                onClick={() => saveMutation.mutate(targets)}
                disabled={saveMutation.isPending}
              >
                <Save size={14} className="mr-1" />
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-muted">
                    <th className="text-left py-2 font-medium">Category</th>
                    <th className="text-right py-2 font-medium">Budget</th>
                    <th className="text-right py-2 font-medium">Actual</th>
                    <th className="text-right py-2 font-medium">Variance</th>
                    <th className="text-right py-2 font-medium">%</th>
                    <th className="text-center py-2 font-medium">Status</th>
                    <th className="text-right py-2 font-medium">YTD Target</th>
                    <th className="text-right py-2 font-medium">YTD Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {vsActual.map((row) => (
                    <tr key={row.accountRef} className="border-b border-muted/50">
                      <td className="py-2">{row.accountRef}</td>
                      <td className="py-2 text-right">
                        ${row.monthlyTarget.toLocaleString()}
                      </td>
                      <td className="py-2 text-right">
                        ${row.monthlyActual.toLocaleString()}
                      </td>
                      <td
                        className={cn(
                          "py-2 text-right",
                          row.variance > 0 ? "text-green-400" : "text-red-400"
                        )}
                      >
                        ${Math.abs(row.variance).toLocaleString()}
                      </td>
                      <td className="py-2 text-right text-muted-foreground">
                        {row.variancePercent.toFixed(1)}%
                      </td>
                      <td className="py-2 text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            row.status === "under" && "text-green-400 border-green-400/30",
                            row.status === "on_track" && "text-yellow-400 border-yellow-400/30",
                            row.status === "over" && "text-red-400 border-red-400/30"
                          )}
                        >
                          {row.status === "under"
                            ? "Under"
                            : row.status === "on_track"
                              ? "On Track"
                              : "Over"}
                        </Badge>
                      </td>
                      <td className="py-2 text-right text-muted-foreground">
                        ${row.ytdTarget.toLocaleString()}
                      </td>
                      <td className="py-2 text-right text-muted-foreground">
                        ${row.ytdActual.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-muted font-medium">
                    <td className="py-2">Total</td>
                    <td className="py-2 text-right">
                      ${totalTarget.toLocaleString()}
                    </td>
                    <td className="py-2 text-right">
                      ${totalActual.toLocaleString()}
                    </td>
                    <td
                      className={cn(
                        "py-2 text-right",
                        totalVariance > 0 ? "text-green-400" : "text-red-400"
                      )}
                    >
                      ${Math.abs(totalVariance).toLocaleString()}
                    </td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
