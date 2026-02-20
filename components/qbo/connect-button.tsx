"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface QboStatus {
  connected: boolean;
  mode: "demo" | "live";
  message?: string;
  practiceName?: string;
}

export function QboConnectButton() {
  const { data: status } = useQuery<QboStatus>({
    queryKey: ["qbo-status"],
    queryFn: async () => {
      const res = await fetch("/api/qbo/status");
      return res.json();
    },
  });

  if (!status) return null;

  if (status.mode === "demo") {
    return (
      <Badge variant="outline" className="text-yellow-500 border-yellow-500">
        Demo Mode
      </Badge>
    );
  }

  if (status.connected) {
    return (
      <div className="flex items-center gap-2">
        <Badge className="bg-green-600">Connected</Badge>
        <span className="text-sm text-muted-foreground">
          {status.practiceName}
        </span>
      </div>
    );
  }

  return (
    <Button asChild>
      <a href="/api/qbo/connect">Connect to QuickBooks</a>
    </Button>
  );
}
