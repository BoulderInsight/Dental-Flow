"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTransactionsStore } from "@/lib/store/transactions-store";
import { X } from "lucide-react";

export function TransactionFilters() {
  const { filters, setFilter, resetFilters } = useTransactionsStore();

  const hasFilters =
    filters.vendor ||
    filters.category ||
    filters.accountRef ||
    filters.minConfidence !== null ||
    filters.maxConfidence !== null ||
    filters.dateFrom ||
    filters.dateTo;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search vendor..."
        value={filters.vendor}
        onChange={(e) => setFilter("vendor", e.target.value)}
        className="w-48 h-8 text-sm"
      />
      <select
        value={filters.category || ""}
        onChange={(e) => setFilter("category", e.target.value || null)}
        className="h-8 rounded-md border bg-background px-2 text-sm"
      >
        <option value="">All Categories</option>
        <option value="business">Business</option>
        <option value="personal">Personal</option>
        <option value="ambiguous">Ambiguous</option>
      </select>
      <Input
        type="text"
        placeholder="Account Ref..."
        value={filters.accountRef || ""}
        onChange={(e) => setFilter("accountRef", e.target.value || null)}
        className="w-36 h-8 text-sm"
      />
      <Input
        type="date"
        value={filters.dateFrom}
        onChange={(e) => setFilter("dateFrom", e.target.value)}
        className="w-36 h-8 text-sm"
      />
      <Input
        type="date"
        value={filters.dateTo}
        onChange={(e) => setFilter("dateTo", e.target.value)}
        className="w-36 h-8 text-sm"
      />
      {hasFilters && (
        <Button
          size="sm"
          variant="ghost"
          onClick={resetFilters}
          className="h-8"
        >
          <X size={14} className="mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
