"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

interface CategoryActionsProps {
  transactionId: string;
  currentCategory: string | null;
}

export function CategoryActions({
  transactionId,
  currentCategory,
}: CategoryActionsProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (category: string) => {
      const res = await fetch(`/api/categorize/${transactionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, confidence: 100 }),
      });
      if (!res.ok) throw new Error("Failed to categorize");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant={currentCategory === "business" ? "default" : "outline"}
        className={
          currentCategory === "business"
            ? "bg-green-700 hover:bg-green-600"
            : "border-green-700 text-green-400 hover:bg-green-900/50"
        }
        onClick={() => mutation.mutate("business")}
        disabled={mutation.isPending}
      >
        Business (B)
      </Button>
      <Button
        size="sm"
        variant={currentCategory === "personal" ? "default" : "outline"}
        className={
          currentCategory === "personal"
            ? "bg-red-700 hover:bg-red-600"
            : "border-red-700 text-red-400 hover:bg-red-900/50"
        }
        onClick={() => mutation.mutate("personal")}
        disabled={mutation.isPending}
      >
        Personal (P)
      </Button>
      <Button
        size="sm"
        variant={currentCategory === "ambiguous" ? "default" : "outline"}
        className={
          currentCategory === "ambiguous"
            ? "bg-yellow-700 hover:bg-yellow-600"
            : "border-yellow-700 text-yellow-400 hover:bg-yellow-900/50"
        }
        onClick={() => mutation.mutate("ambiguous")}
        disabled={mutation.isPending}
      >
        Ambiguous
      </Button>
    </div>
  );
}
