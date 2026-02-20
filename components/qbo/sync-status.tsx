"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";

export function SyncStatus() {
  const queryClient = useQueryClient();

  const { data: status } = useQuery({
    queryKey: ["sync-status"],
    queryFn: async () => {
      const res = await fetch("/api/transactions?limit=1");
      return res.json();
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/qbo/sync", { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-status"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  return (
    <div className="flex items-center gap-3">
      <Badge variant="outline">
        {status?.total ?? 0} transactions
      </Badge>
      <Button
        variant="outline"
        size="sm"
        onClick={() => syncMutation.mutate()}
        disabled={syncMutation.isPending}
      >
        <RefreshCw
          size={14}
          className={syncMutation.isPending ? "animate-spin mr-1" : "mr-1"}
        />
        {syncMutation.isPending ? "Syncing..." : "Sync Now"}
      </Button>
    </div>
  );
}
