"use client";

import { useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useReviewStore } from "@/lib/store/review-store";
import { TransactionTable, type TransactionRow } from "./transaction-table";
import { TransactionDetail } from "./transaction-detail";
import { ReviewProgress } from "./review-progress";
import { ReviewFilters } from "./filters";
import { ShortcutBar } from "./shortcut-bar";
import { BatchActionBar } from "./batch-action-bar";
import { useKeyboardShortcuts } from "@/lib/hooks/use-keyboard-shortcuts";
import { toast } from "sonner";

interface TransactionsResponse {
  transactions: TransactionRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function ReviewPanel() {
  const queryClient = useQueryClient();
  const {
    selectedTransactionId,
    selectTransaction,
    filters,
    page,
    setPage,
    showHelp,
    toggleHelp,
  } = useReviewStore();

  const { data, isLoading } = useQuery<TransactionsResponse>({
    queryKey: ["transactions", filters, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "50");
      params.set("sortBy", "date");
      params.set("sortDir", "desc");
      if (filters.vendor) params.set("vendor", filters.vendor);
      if (filters.category) params.set("category", filters.category);
      if (filters.minConfidence !== null)
        params.set("minConfidence", String(filters.minConfidence));
      if (filters.maxConfidence !== null)
        params.set("maxConfidence", String(filters.maxConfidence));
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);

      const res = await fetch(`/api/transactions?${params}`);
      return res.json();
    },
  });

  const transactions = useMemo(() => data?.transactions ?? [], [data?.transactions]);
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const categorized = transactions.filter((t) => t.category !== null).length;
  const flagged = transactions.filter(
    (t) =>
      t.category === "ambiguous" ||
      (t.confidence !== null && t.confidence < 70)
  ).length;

  const selectedTransaction =
    transactions.find((t) => t.id === selectedTransactionId) ?? null;

  const categorizeMutation = useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string }) => {
      const res = await fetch(`/api/categorize/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, confidence: 100 }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      // Auto-advance to next transaction
      const idx = transactions.findIndex(
        (t) => t.id === selectedTransactionId
      );
      if (idx < transactions.length - 1) {
        selectTransaction(transactions[idx + 1].id);
      }
    },
  });

  const categorizeSelected = useCallback(
    (category: string) => {
      if (!selectedTransactionId) {
        toast.info("Select a transaction first");
        return;
      }
      categorizeMutation.mutate({ id: selectedTransactionId, category });
    },
    [selectedTransactionId, categorizeMutation]
  );

  const navigate = useCallback(
    (direction: "next" | "prev") => {
      if (transactions.length === 0) return;
      const idx = transactions.findIndex(
        (t) => t.id === selectedTransactionId
      );
      if (direction === "next") {
        const next = idx < transactions.length - 1 ? idx + 1 : 0;
        selectTransaction(transactions[next].id);
      } else {
        const prev = idx > 0 ? idx - 1 : transactions.length - 1;
        selectTransaction(transactions[prev].id);
      }
    },
    [transactions, selectedTransactionId, selectTransaction]
  );

  const shortcutActions = useMemo(
    () => ({
      onBusiness: () => categorizeSelected("business"),
      onPersonal: () => categorizeSelected("personal"),
      onAmbiguous: () => categorizeSelected("ambiguous"),
      onNext: () => navigate("next"),
      onPrevious: () => navigate("prev"),
      onCreateRule: () => toast.info("Rule creation coming in Step 7"),
      onToggleHelp: toggleHelp,
    }),
    [categorizeSelected, navigate, toggleHelp]
  );

  useKeyboardShortcuts(shortcutActions);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
      <ReviewProgress
        total={total}
        categorized={categorized}
        flagged={flagged}
      />

      <ReviewFilters />

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Left: Transaction list (60%) */}
        <div className="flex-[3] overflow-auto rounded-lg border bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
              Loading transactions...
            </div>
          ) : (
            <TransactionTable
              data={transactions}
              selectedId={selectedTransactionId}
              onSelect={selectTransaction}
            />
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-3 py-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Right: Detail panel (40%) */}
        <div className="flex-[2] overflow-auto rounded-lg border bg-card">
          <TransactionDetail transaction={selectedTransaction} />
        </div>
      </div>

      <BatchActionBar />
      <ShortcutBar />

      {/* Help Overlay */}
      {showHelp && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
          onClick={toggleHelp}
        >
          <div
            className="rounded-lg border bg-card p-6 shadow-lg max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Keyboard Shortcuts</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Categorize as Business</span>
                <kbd className="rounded bg-muted px-2 py-0.5 font-mono">B</kbd>
              </div>
              <div className="flex justify-between">
                <span>Categorize as Personal</span>
                <kbd className="rounded bg-muted px-2 py-0.5 font-mono">P</kbd>
              </div>
              <div className="flex justify-between">
                <span>Categorize as Ambiguous</span>
                <kbd className="rounded bg-muted px-2 py-0.5 font-mono">A</kbd>
              </div>
              <div className="flex justify-between">
                <span>Next Transaction</span>
                <kbd className="rounded bg-muted px-2 py-0.5 font-mono">J / &darr;</kbd>
              </div>
              <div className="flex justify-between">
                <span>Previous Transaction</span>
                <kbd className="rounded bg-muted px-2 py-0.5 font-mono">K / &uarr;</kbd>
              </div>
              <div className="flex justify-between">
                <span>Create Rule</span>
                <kbd className="rounded bg-muted px-2 py-0.5 font-mono">R</kbd>
              </div>
              <div className="flex justify-between">
                <span>Toggle Help</span>
                <kbd className="rounded bg-muted px-2 py-0.5 font-mono">?</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
