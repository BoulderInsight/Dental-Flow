"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardCheck, RefreshCw, Zap } from "lucide-react";

export function QuickActions() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const categorizeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/categorize", { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Categorization failed"),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/qbo/sync", { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.message || `Synced ${data.transactionCount} transactions`);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Sync failed"),
  });

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        onClick={() => router.push("/review")}
      >
        <ClipboardCheck size={16} className="mr-1.5" />
        Start Review
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => categorizeMutation.mutate()}
        disabled={categorizeMutation.isPending}
      >
        <Zap size={16} className="mr-1.5" />
        {categorizeMutation.isPending ? "Running..." : "Run Categorization"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => syncMutation.mutate()}
        disabled={syncMutation.isPending}
      >
        <RefreshCw size={16} className="mr-1.5" />
        {syncMutation.isPending ? "Syncing..." : "Sync QBO"}
      </Button>
    </div>
  );
}
