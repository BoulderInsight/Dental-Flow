"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFeedbackStore } from "@/lib/store/feedback-store";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { toast } from "sonner";

interface CategoryActionsProps {
  transactionId: string;
  currentCategory: string | null;
  vendorName?: string | null;
}

export function CategoryActions({
  transactionId,
  currentCategory,
  vendorName,
}: CategoryActionsProps) {
  const queryClient = useQueryClient();
  const recordCorrection = useFeedbackStore((s) => s.recordCorrection);
  const { canWrite } = usePermissions();

  const mutation = useMutation({
    mutationFn: async (category: string) => {
      const res = await fetch(`/api/categorize/${transactionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, confidence: 100 }),
      });
      if (!res.ok) throw new Error("Failed to categorize");
      return { ...(await res.json()), category };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-history"] });

      // Track feedback for rule suggestion
      if (vendorName) {
        const count = recordCorrection(vendorName, data.category);
        if (count >= 2) {
          toast.info(
            `You've categorized "${vendorName}" as ${data.category} ${count} times. Create a rule?`,
            {
              action: {
                label: "Create Rule",
                onClick: () => createRule(vendorName, data.category),
              },
              duration: 8000,
            }
          );
        }
      }
    },
  });

  async function createRule(vendor: string, category: string) {
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchType: "vendor",
          matchValue: vendor,
          category,
        }),
      });
      if (res.ok) {
        toast.success(`Rule created: "${vendor}" → ${category}`);
      } else {
        toast.error("Failed to create rule");
      }
    } catch {
      toast.error("Failed to create rule");
    }
  }

  if (!canWrite) {
    return (
      <div className="flex gap-2">
        <Badge variant="outline" className="text-blue-400 border-blue-400/30">
          View Only
        </Badge>
      </div>
    );
  }

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
