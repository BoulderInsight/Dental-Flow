"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdvisoryDisclaimer } from "@/components/ui/advisory-disclaimer";
import { usePermissions } from "@/lib/hooks/use-permissions";
import {
  Landmark,
  Plus,
  Trash2,
  Check,
  X,
  Search,
  DollarSign,
  Percent,
  Calendar,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface LoanRow {
  id: string;
  name: string;
  lender: string | null;
  originalAmount: string | null;
  currentBalance: string | null;
  interestRate: string | null;
  monthlyPayment: string | null;
  remainingMonths: number | null;
  loanType: string;
  startDate: string | null;
  maturityDate: string | null;
  isAutoDetected: boolean;
  matchedTransactionPattern: string | null;
}

interface DetectedLoan {
  name: string;
  estimatedMonthlyPayment: number;
  frequency: "monthly" | "quarterly";
  transactionPattern: string;
  firstSeen: string;
  lastSeen: string;
  occurrences: number;
}

const LOAN_TYPES = [
  { value: "practice_acquisition", label: "Practice Acquisition" },
  { value: "equipment", label: "Equipment" },
  { value: "real_estate", label: "Real Estate / Mortgage" },
  { value: "line_of_credit", label: "Line of Credit" },
  { value: "sba", label: "SBA Loan" },
  { value: "vehicle", label: "Vehicle" },
  { value: "student", label: "Student Loan" },
  { value: "other", label: "Other" },
];

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatRate(rate: string | null): string {
  if (!rate) return "--";
  return `${(parseFloat(rate) * 100).toFixed(2)}%`;
}

function loanTypeLabel(type: string): string {
  return LOAN_TYPES.find((t) => t.value === type)?.label || type;
}

export default function LoansPage() {
  const queryClient = useQueryClient();
  const { canWrite } = usePermissions();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [dismissedDetected, setDismissedDetected] = useState<Set<string>>(
    new Set()
  );

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    lender: "",
    originalAmount: "",
    currentBalance: "",
    interestRate: "",
    monthlyPayment: "",
    remainingMonths: "",
    loanType: "other",
    startDate: "",
    maturityDate: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["loans"],
    queryFn: async () => {
      const res = await fetch("/api/finance/loans");
      if (!res.ok) throw new Error("Failed to load loans");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (loanData: Record<string, unknown>) => {
      const res = await fetch("/api/finance/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loanData),
      });
      if (!res.ok) throw new Error("Failed to create loan");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      setAddDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/finance/loans/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete loan");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
    },
  });

  function resetForm() {
    setFormData({
      name: "",
      lender: "",
      originalAmount: "",
      currentBalance: "",
      interestRate: "",
      monthlyPayment: "",
      remainingMonths: "",
      loanType: "other",
      startDate: "",
      maturityDate: "",
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      name: formData.name,
      lender: formData.lender || null,
      originalAmount: formData.originalAmount
        ? parseFloat(formData.originalAmount)
        : null,
      currentBalance: formData.currentBalance
        ? parseFloat(formData.currentBalance)
        : null,
      interestRate: formData.interestRate
        ? parseFloat(formData.interestRate) / 100
        : null,
      monthlyPayment: formData.monthlyPayment
        ? parseFloat(formData.monthlyPayment)
        : null,
      remainingMonths: formData.remainingMonths
        ? parseInt(formData.remainingMonths, 10)
        : null,
      loanType: formData.loanType,
      startDate: formData.startDate || null,
      maturityDate: formData.maturityDate || null,
    });
  }

  function handleConfirmDetected(detected: DetectedLoan) {
    createMutation.mutate({
      name: detected.name,
      monthlyPayment: detected.estimatedMonthlyPayment,
      loanType: "other",
      isAutoDetected: true,
      matchedTransactionPattern: detected.transactionPattern,
    });
  }

  function handleDismissDetected(pattern: string) {
    setDismissedDetected((prev) => new Set(prev).add(pattern));
  }

  const allLoans: LoanRow[] = data?.loans || [];
  const detectedLoans: DetectedLoan[] = (data?.detected || []).filter(
    (d: DetectedLoan) => !dismissedDetected.has(d.transactionPattern)
  );

  // Summary stats
  const totalBalance = allLoans.reduce(
    (sum, l) => sum + (l.currentBalance ? parseFloat(l.currentBalance) : 0),
    0
  );
  const totalMonthlyPayment = allLoans.reduce(
    (sum, l) => sum + (l.monthlyPayment ? parseFloat(l.monthlyPayment) : 0),
    0
  );
  const totalAnnualDebtService = totalMonthlyPayment * 12;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Loan Management</h1>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted/30 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Loan Management</h1>
          <p className="text-muted-foreground">
            Track your debt obligations and auto-detect recurring loan payments
          </p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus size={14} className="mr-1" />
            Add Loan
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Debt</CardTitle>
            <DollarSign size={16} className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalBalance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {allLoans.length} active loan{allLoans.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Monthly Debt Service
            </CardTitle>
            <Calendar size={16} className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalMonthlyPayment)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">per month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Annual Debt Service
            </CardTitle>
            <Percent size={16} className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalAnnualDebtService)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">per year</p>
          </CardContent>
        </Card>
      </div>

      {/* Auto-detected Loans */}
      {detectedLoans.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search size={16} className="text-amber-500" />
              <CardTitle className="text-base">Auto-detected Loans</CardTitle>
              <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                {detectedLoans.length} found
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              We found recurring payment patterns that may be loan payments.
              Confirm to add them to your loan tracker.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {detectedLoans.map((d) => (
                <div
                  key={d.transactionPattern}
                  className="flex items-center justify-between p-3 rounded-md border border-muted"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{d.name}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                      <span>
                        ~{formatCurrency(d.estimatedMonthlyPayment)}/mo
                      </span>
                      <span>{d.frequency}</span>
                      <span>{d.occurrences} occurrences</span>
                    </div>
                  </div>
                  {canWrite && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-green-500 hover:text-green-400"
                        onClick={() => handleConfirmDetected(d)}
                        disabled={createMutation.isPending}
                      >
                        <Check size={14} className="mr-1" />
                        Confirm
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() =>
                          handleDismissDetected(d.transactionPattern)
                        }
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loans Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Landmark size={16} />
            Your Loans
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allLoans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Landmark size={32} className="mx-auto mb-3 opacity-40" />
              <p>No loans tracked yet.</p>
              <p className="text-sm mt-1">
                Add loans manually or wait for auto-detection to find recurring
                payments.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-muted">
                    <th className="text-left py-2 font-medium">Name</th>
                    <th className="text-left py-2 font-medium">Lender</th>
                    <th className="text-left py-2 font-medium">Type</th>
                    <th className="text-right py-2 font-medium">Balance</th>
                    <th className="text-right py-2 font-medium">Rate</th>
                    <th className="text-right py-2 font-medium">Payment</th>
                    <th className="text-right py-2 font-medium">
                      Remaining Mo.
                    </th>
                    <th className="text-center py-2 font-medium">Source</th>
                    {canWrite && (
                      <th className="text-center py-2 font-medium">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {allLoans.map((loan) => (
                    <tr
                      key={loan.id}
                      className="border-b border-muted/50 hover:bg-muted/30"
                    >
                      <td className="py-2 font-medium">{loan.name}</td>
                      <td className="py-2 text-muted-foreground">
                        {loan.lender || "--"}
                      </td>
                      <td className="py-2">
                        <Badge variant="outline" className="text-xs">
                          {loanTypeLabel(loan.loanType)}
                        </Badge>
                      </td>
                      <td className="py-2 text-right">
                        {loan.currentBalance
                          ? formatCurrency(parseFloat(loan.currentBalance))
                          : "--"}
                      </td>
                      <td className="py-2 text-right">
                        {formatRate(loan.interestRate)}
                      </td>
                      <td className="py-2 text-right">
                        {loan.monthlyPayment
                          ? formatCurrency(parseFloat(loan.monthlyPayment))
                          : "--"}
                      </td>
                      <td className="py-2 text-right">
                        {loan.remainingMonths ?? "--"}
                      </td>
                      <td className="py-2 text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            loan.isAutoDetected
                              ? "text-amber-500 border-amber-500/30"
                              : "text-blue-500 border-blue-500/30"
                          )}
                        >
                          {loan.isAutoDetected ? "Auto" : "Manual"}
                        </Badge>
                      </td>
                      {canWrite && (
                        <td className="py-2 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300 h-7 w-7 p-0"
                            onClick={() => deleteMutation.mutate(loan.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AdvisoryDisclaimer />

      {/* Add Loan Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent onClose={() => setAddDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>Add Loan</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">
                  Name <span className="text-red-400">*</span>
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g. Equipment Loan #1234"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Lender</label>
                <Input
                  value={formData.lender}
                  onChange={(e) =>
                    setFormData({ ...formData, lender: e.target.value })
                  }
                  placeholder="e.g. Bank of America"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">
                Loan Type <span className="text-red-400">*</span>
              </label>
              <Select
                value={formData.loanType}
                onChange={(e) =>
                  setFormData({ ...formData, loanType: e.target.value })
                }
              >
                {LOAN_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Original Amount</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.originalAmount}
                  onChange={(e) =>
                    setFormData({ ...formData, originalAmount: e.target.value })
                  }
                  placeholder="500000"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Current Balance</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.currentBalance}
                  onChange={(e) =>
                    setFormData({ ...formData, currentBalance: e.target.value })
                  }
                  placeholder="350000"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">
                  Interest Rate (%)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.interestRate}
                  onChange={(e) =>
                    setFormData({ ...formData, interestRate: e.target.value })
                  }
                  placeholder="7.5"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Monthly Payment</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.monthlyPayment}
                  onChange={(e) =>
                    setFormData({ ...formData, monthlyPayment: e.target.value })
                  }
                  placeholder="4500"
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  Remaining Months
                </label>
                <Input
                  type="number"
                  value={formData.remainingMonths}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      remainingMonths: e.target.value,
                    })
                  }
                  placeholder="120"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Maturity Date</label>
                <Input
                  type="date"
                  value={formData.maturityDate}
                  onChange={(e) =>
                    setFormData({ ...formData, maturityDate: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setAddDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Saving..." : "Add Loan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
