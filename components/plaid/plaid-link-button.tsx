"use client";

import { useState, useEffect, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";

interface PlaidLinkButtonProps {
  onSuccess?: () => void;
}

export default function PlaidLinkButton({ onSuccess }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchLinkToken() {
      try {
        const res = await fetch("/api/plaid/link-token", { method: "POST" });
        if (!res.ok) throw new Error("Failed to get link token");
        const data = await res.json();
        setLinkToken(data.linkToken);
      } catch (err) {
        console.error("Link token error:", err);
      }
    }
    fetchLinkToken();
  }, []);

  const handlePlaidSuccess = useCallback(
    async (publicToken: string, metadata: { institution?: { name?: string; institution_id?: string } | null }) => {
      setLoading(true);
      try {
        const res = await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicToken,
            institutionName: metadata.institution?.name || "Unknown",
            institutionId: metadata.institution?.institution_id || "unknown",
          }),
        });

        if (!res.ok) throw new Error("Exchange failed");

        const data = await res.json();
        toast.success(
          `Connected ${metadata.institution?.name || "institution"} with ${data.accountCount} accounts`
        );
        onSuccess?.();
      } catch {
        toast.error("Failed to connect account");
      } finally {
        setLoading(false);
      }
    },
    [onSuccess]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handlePlaidSuccess,
    onExit: () => {},
  });

  return (
    <Button
      onClick={() => open()}
      disabled={!ready || loading}
      variant="outline"
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin mr-2" />
      ) : (
        <Plus size={16} className="mr-2" />
      )}
      Connect Bank Account
    </Button>
  );
}
