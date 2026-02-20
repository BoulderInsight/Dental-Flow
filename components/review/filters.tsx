"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useReviewStore } from "@/lib/store/review-store";
import { X } from "lucide-react";

export function ReviewFilters() {
  const { filters, setFilter, resetFilters } = useReviewStore();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search vendor..."
        value={filters.vendor}
        onChange={(e) => setFilter("vendor", e.target.value)}
        className="w-48 h-8 text-sm"
      />
      <Select
        value={filters.category || ""}
        onChange={(e) => setFilter("category", e.target.value || null)}
        className="w-36 h-8 text-sm"
      >
        <option value="">All categories</option>
        <option value="business">Business</option>
        <option value="personal">Personal</option>
        <option value="ambiguous">Ambiguous</option>
      </Select>
      <Select
        value={
          filters.maxConfidence !== null
            ? String(filters.maxConfidence)
            : ""
        }
        onChange={(e) => {
          const val = e.target.value;
          if (!val) {
            setFilter("minConfidence", null);
            setFilter("maxConfidence", null);
          } else if (val === "70") {
            setFilter("minConfidence", null);
            setFilter("maxConfidence", 69);
          } else if (val === "89") {
            setFilter("minConfidence", 70);
            setFilter("maxConfidence", 89);
          } else if (val === "100") {
            setFilter("minConfidence", 90);
            setFilter("maxConfidence", 100);
          }
        }}
        className="w-40 h-8 text-sm"
      >
        <option value="">All confidence</option>
        <option value="70">Low (&lt; 70%)</option>
        <option value="89">Medium (70-89%)</option>
        <option value="100">High (90-100%)</option>
      </Select>
      {(filters.vendor || filters.category || filters.maxConfidence !== null) && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={resetFilters}
        >
          <X size={14} className="mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
