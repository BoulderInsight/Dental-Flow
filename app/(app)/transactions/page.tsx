"use client";

import { useQuery } from "@tanstack/react-query";
import { useTransactionsStore } from "@/lib/store/transactions-store";
import {
  TransactionListTable,
  type TransactionListRow,
} from "@/components/transactions/transaction-list-table";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { ExportButton } from "@/components/transactions/export-button";

interface TransactionsResponse {
  transactions: TransactionListRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function TransactionsPage() {
  const { filters, sortBy, sortDir, page, setPage } = useTransactionsStore();

  const { data, isLoading } = useQuery<TransactionsResponse>({
    queryKey: ["all-transactions", filters, sortBy, sortDir, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "50");
      params.set("sortBy", sortBy);
      params.set("sortDir", sortDir);
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

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground mt-1">
            All synced transactions from QuickBooks Online.{" "}
            <span className="text-foreground font-medium">{total}</span> total.
          </p>
        </div>
        <ExportButton data={transactions} />
      </div>

      <TransactionFilters />

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
            Loading transactions...
          </div>
        ) : (
          <TransactionListTable data={transactions} />
        )}

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
    </div>
  );
}
