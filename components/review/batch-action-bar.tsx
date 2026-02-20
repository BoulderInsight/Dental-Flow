"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useReviewStore } from "@/lib/store/review-store";
import { toast } from "sonner";
import { X } from "lucide-react";

export function BatchActionBar() {
  const queryClient = useQueryClient();
  const { selectedTransactionIds, clearBatchSelection } = useReviewStore();

  const mutation = useMutation({
    mutationFn: async (category: string) => {
      const res = await fetch("/api/categorize/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionIds: selectedTransactionIds,
          category,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Categorized ${data.categorized} transactions as ${data.category}`);
      clearBatchSelection();
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: () => toast.error("Batch categorization failed"),
  });

  if (selectedTransactionIds.length === 0) return null;

  return (
    <div className="fixed bottom-10 left-1/2 z-50 -translate-x-1/2 rounded-lg border bg-card px-4 py-3 shadow-lg">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">
          {selectedTransactionIds.length} selected
        </span>
        <Button
          size="sm"
          className="bg-green-700 hover:bg-green-600"
          onClick={() => mutation.mutate("business")}
          disabled={mutation.isPending}
        >
          Business
        </Button>
        <Button
          size="sm"
          className="bg-red-700 hover:bg-red-600"
          onClick={() => mutation.mutate("personal")}
          disabled={mutation.isPending}
        >
          Personal
        </Button>
        <Button
          size="sm"
          className="bg-yellow-700 hover:bg-yellow-600"
          onClick={() => mutation.mutate("ambiguous")}
          disabled={mutation.isPending}
        >
          Ambiguous
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={clearBatchSelection}
        >
          <X size={14} />
        </Button>
      </div>
    </div>
  );
}
