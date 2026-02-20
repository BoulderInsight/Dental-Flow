"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, RefreshCw, Landmark, CreditCard, Wallet, Building2 } from "lucide-react";
import PlaidLinkButton from "@/components/plaid/plaid-link-button";

interface PlaidAccount {
  id: string;
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  currentBalance: number;
  availableBalance: number | null;
  isIncludedInNetWorth: boolean;
  lastBalanceUpdate: string | null;
}

interface PlaidConnection {
  id: string;
  institutionName: string;
  status: string;
  lastSyncedAt: string | null;
  accounts: PlaidAccount[];
}

function accountTypeIcon(type: string) {
  switch (type.toLowerCase()) {
    case "depository":
      return <Landmark size={14} />;
    case "credit":
      return <CreditCard size={14} />;
    case "investment":
      return <Wallet size={14} />;
    case "loan":
      return <Building2 size={14} />;
    default:
      return <Landmark size={14} />;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export default function ConnectedAccountsPage() {
  const queryClient = useQueryClient();

  const { data: connections = [], isLoading } = useQuery<PlaidConnection[]>({
    queryKey: ["plaid-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/plaid/accounts");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => fetch("/api/plaid/sync", { method: "POST" }),
    onSuccess: () => {
      toast.success("Balances refreshed");
      queryClient.invalidateQueries({ queryKey: ["plaid-accounts"] });
    },
    onError: () => toast.error("Failed to sync balances"),
  });

  const disconnectMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await fetch(`/api/plaid/connections/${connectionId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      toast.success("Institution disconnected");
      queryClient.invalidateQueries({ queryKey: ["plaid-accounts"] });
    },
    onError: () => toast.error("Failed to disconnect"),
  });

  const toggleNetWorthMutation = useMutation({
    mutationFn: async ({
      accountId,
      included,
    }: {
      accountId: string;
      included: boolean;
    }) => {
      const res = await fetch(`/api/plaid/accounts/${accountId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isIncludedInNetWorth: included }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plaid-accounts"] });
    },
  });

  const totalAccounts = connections.reduce(
    (sum, c) => sum + c.accounts.length,
    0
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Connected Accounts</h1>
          <p className="text-muted-foreground mt-1">
            Manage bank connections for net worth tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connections.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <RefreshCw
                size={14}
                className={syncMutation.isPending ? "animate-spin" : ""}
              />
              <span className="ml-1">Refresh Balances</span>
            </Button>
          )}
          <PlaidLinkButton
            onSuccess={() =>
              queryClient.invalidateQueries({ queryKey: ["plaid-accounts"] })
            }
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-32 bg-muted/30 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : connections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Landmark size={48} className="text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No accounts connected</p>
            <p className="text-sm text-muted-foreground mb-6">
              Connect your bank accounts to track your net worth
            </p>
            <PlaidLinkButton
              onSuccess={() =>
                queryClient.invalidateQueries({ queryKey: ["plaid-accounts"] })
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="text-sm text-muted-foreground">
            {connections.length} institution{connections.length !== 1 ? "s" : ""},{" "}
            {totalAccounts} account{totalAccounts !== 1 ? "s" : ""}
          </div>

          {connections.map((conn) => (
            <Card key={conn.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base">
                    {conn.institutionName}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={
                      conn.status === "active"
                        ? "text-green-400 border-green-700"
                        : conn.status === "error"
                          ? "text-red-400 border-red-700"
                          : "text-yellow-400 border-yellow-700"
                    }
                  >
                    {conn.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {conn.lastSyncedAt && (
                    <span className="text-xs text-muted-foreground">
                      Last synced:{" "}
                      {new Date(conn.lastSyncedAt).toLocaleDateString()}
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => disconnectMutation.mutate(conn.id)}
                    disabled={disconnectMutation.isPending}
                  >
                    <Trash2 size={14} className="text-red-400" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {conn.accounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between rounded-md border border-border/50 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">
                          {accountTypeIcon(account.type)}
                        </span>
                        <div>
                          <p className="text-sm font-medium">{account.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {account.type}
                            {account.subtype ? ` - ${account.subtype}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-mono">
                          {formatCurrency(account.currentBalance)}
                        </span>
                        <button
                          onClick={() =>
                            toggleNetWorthMutation.mutate({
                              accountId: account.id,
                              included: !account.isIncludedInNetWorth,
                            })
                          }
                          className={`text-xs px-2 py-1 rounded border transition-colors ${
                            account.isIncludedInNetWorth
                              ? "border-green-700 text-green-400 hover:bg-green-950"
                              : "border-border text-muted-foreground hover:bg-accent"
                          }`}
                        >
                          {account.isIncludedInNetWorth
                            ? "In Net Worth"
                            : "Excluded"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
