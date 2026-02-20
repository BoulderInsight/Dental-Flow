"use client";

import { useQuery } from "@tanstack/react-query";
import { useReviewStore } from "@/lib/store/review-store";
import { TransactionTable, type TransactionRow } from "./transaction-table";
import { TransactionDetail } from "./transaction-detail";
import { ReviewProgress } from "./review-progress";
import { ReviewFilters } from "./filters";

interface TransactionsResponse {
  transactions: TransactionRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function ReviewPanel() {
  const {
    selectedTransactionId,
    selectTransaction,
    filters,
    page,
    setPage,
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

  const transactions = data?.transactions ?? [];
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
    </div>
  );
}
