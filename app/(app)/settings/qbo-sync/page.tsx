"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePermissions } from "@/lib/hooks/use-permissions";
import {
  RefreshCw,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRightLeft,
  History,
  Settings2,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QBOAccount {
  id: string;
  name: string;
  type: string;
}

interface AccountMapping {
  id: string;
  ourCategory: string;
  qboAccountId: string;
  qboAccountName: string;
}

interface WriteBackItem {
  transactionId: string;
  qboTxnId: string;
  qboTxnType: string;
  currentAccountRef: string;
  targetAccountRef: string;
  targetAccountId: string;
  category: string;
  confidence: number;
  amount: number;
  vendorName: string | null;
  date: string;
}

interface WriteBackPreview {
  items: WriteBackItem[];
  totalTransactions: number;
  accountMappings: Record<string, string>;
}

interface HistoryEntry {
  id: string;
  userId: string | null;
  createdAt: string;
  details: {
    succeeded: number;
    failed: number;
    totalRequested: number;
    errorCount: number;
  };
}

// ---------------------------------------------------------------------------
// Category options
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { value: "business", label: "Business" },
  { value: "personal", label: "Personal" },
  { value: "ambiguous", label: "Ambiguous" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function QBOSyncPage() {
  const queryClient = useQueryClient();
  const { canAdmin } = usePermissions();

  // State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sinceDate, setSinceDate] = useState("");
  const [confidenceThreshold, setConfidenceThreshold] = useState(true); // >= 90%
  const [categoryFilter, setCategoryFilter] = useState<string[]>([
    "business",
    "personal",
    "ambiguous",
  ]);

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  const { data: accountsData, isLoading: loadingAccounts } = useQuery({
    queryKey: ["qbo-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/qbo/accounts");
      if (!res.ok) throw new Error("Failed to load QBO accounts");
      return res.json() as Promise<{ accounts: QBOAccount[] }>;
    },
  });

  const { data: mappingsData, isLoading: loadingMappings } = useQuery({
    queryKey: ["qbo-account-mappings"],
    queryFn: async () => {
      const res = await fetch("/api/qbo/account-mappings");
      if (!res.ok) throw new Error("Failed to load mappings");
      return res.json() as Promise<{ mappings: AccountMapping[] }>;
    },
  });

  const previewParams = new URLSearchParams();
  if (sinceDate) previewParams.set("sinceDate", sinceDate);
  previewParams.set("onlyHighConfidence", String(confidenceThreshold));
  if (categoryFilter.length > 0 && categoryFilter.length < 3) {
    previewParams.set("categories", categoryFilter.join(","));
  }

  const {
    data: previewData,
    isLoading: loadingPreview,
    refetch: refetchPreview,
  } = useQuery({
    queryKey: ["qbo-write-back-preview", sinceDate, confidenceThreshold, categoryFilter],
    queryFn: async () => {
      const res = await fetch(
        `/api/qbo/write-back/preview?${previewParams.toString()}`
      );
      if (!res.ok) throw new Error("Failed to load preview");
      return res.json() as Promise<WriteBackPreview>;
    },
  });

  const { data: historyData } = useQuery({
    queryKey: ["qbo-write-back-history"],
    queryFn: async () => {
      const res = await fetch("/api/qbo/write-back/history");
      if (!res.ok) throw new Error("Failed to load history");
      return res.json() as Promise<{ history: HistoryEntry[] }>;
    },
  });

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  const saveMappingsMutation = useMutation({
    mutationFn: async (
      mappings: Array<{
        ourCategory: string;
        qboAccountId: string;
        qboAccountName: string;
      }>
    ) => {
      const res = await fetch("/api/qbo/account-mappings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings }),
      });
      if (!res.ok) throw new Error("Failed to save mappings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qbo-account-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["qbo-write-back-preview"] });
    },
  });

  const executeWriteBackMutation = useMutation({
    mutationFn: async (transactionIds: string[]) => {
      const res = await fetch("/api/qbo/write-back/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionIds }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to execute write-back");
      }
      return res.json();
    },
    onSuccess: () => {
      setConfirmOpen(false);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["qbo-write-back-preview"] });
      queryClient.invalidateQueries({ queryKey: ["qbo-write-back-history"] });
    },
  });

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  // Get current mapping state from the server data, allow local edits
  const [localMappings, setLocalMappings] = useState<
    Record<string, { qboAccountId: string; qboAccountName: string }>
  >({});

  // Initialize local mappings from server data
  const mappings = mappingsData?.mappings || [];
  const effectiveMappings: Record<
    string,
    { qboAccountId: string; qboAccountName: string }
  > = {};
  for (const m of mappings) {
    effectiveMappings[m.ourCategory] = {
      qboAccountId: m.qboAccountId,
      qboAccountName: m.qboAccountName,
    };
  }
  // Override with local edits
  for (const [cat, val] of Object.entries(localMappings)) {
    effectiveMappings[cat] = val;
  }

  const accounts = accountsData?.accounts || [];
  const preview = previewData;

  function handleMappingChange(category: string, accountId: string) {
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return;
    setLocalMappings((prev) => ({
      ...prev,
      [category]: { qboAccountId: accountId, qboAccountName: account.name },
    }));
  }

  function handleSaveMappings() {
    const toSave = CATEGORIES.map((cat) => ({
      ourCategory: cat.value,
      qboAccountId: effectiveMappings[cat.value]?.qboAccountId || "",
      qboAccountName: effectiveMappings[cat.value]?.qboAccountName || "",
    })).filter((m) => m.qboAccountId !== "");

    saveMappingsMutation.mutate(toSave);
  }

  const toggleSelect = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    []
  );

  function toggleSelectAll() {
    if (!preview?.items) return;
    if (selectedIds.size === preview.items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(preview.items.map((i) => i.transactionId)));
    }
  }

  function toggleCategory(cat: string) {
    setCategoryFilter((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function formatCurrency(n: number): string {
    return `$${Math.abs(n).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatDate(d: string): string {
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">QBO Sync & Write-back</h1>
        <p className="text-muted-foreground">
          Map categories to QuickBooks accounts and push categorizations back to
          QBO
        </p>
      </div>

      {/* Admin Notice */}
      {!canAdmin && (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm flex items-center gap-2">
          <Shield size={16} className="text-amber-500" />
          <span>
            Write-back execution requires owner access. You can view mappings and
            previews but cannot push changes to QuickBooks.
          </span>
        </div>
      )}

      {/* Account Mappings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 size={18} className="text-muted-foreground" />
            <CardTitle className="text-base">Account Mappings</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveMappings}
            disabled={
              saveMappingsMutation.isPending ||
              Object.keys(localMappings).length === 0
            }
          >
            {saveMappingsMutation.isPending ? "Saving..." : "Save Mappings"}
          </Button>
        </CardHeader>
        <CardContent>
          {loadingAccounts || loadingMappings ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-10 bg-muted/30 rounded animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Map each transaction category to its corresponding QuickBooks
                account. Write-back will re-assign transactions in QBO to these
                accounts.
              </p>
              {CATEGORIES.map((cat) => (
                <div
                  key={cat.value}
                  className="flex items-center gap-4"
                >
                  <div className="w-32">
                    <Badge
                      variant="outline"
                      className={cn(
                        cat.value === "business"
                          ? "border-green-500/30 text-green-400"
                          : cat.value === "personal"
                            ? "border-blue-500/30 text-blue-400"
                            : "border-yellow-500/30 text-yellow-400"
                      )}
                    >
                      {cat.label}
                    </Badge>
                  </div>
                  <ArrowRightLeft
                    size={16}
                    className="text-muted-foreground"
                  />
                  <Select
                    className="flex-1"
                    value={effectiveMappings[cat.value]?.qboAccountId || ""}
                    onChange={(e) =>
                      handleMappingChange(cat.value, e.target.value)
                    }
                  >
                    <option value="">Select QBO Account...</option>
                    {accounts.map((acct) => (
                      <option key={acct.id} value={acct.id}>
                        {acct.name} ({acct.type})
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
              {saveMappingsMutation.isSuccess && (
                <p className="text-sm text-green-400 flex items-center gap-1">
                  <CheckCircle2 size={14} />
                  Mappings saved successfully
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Write-back Preview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload size={18} className="text-muted-foreground" />
            <CardTitle className="text-base">Write-back Preview</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchPreview()}
              disabled={loadingPreview}
            >
              <RefreshCw
                size={14}
                className={loadingPreview ? "animate-spin" : ""}
              />
              <span className="ml-1">Refresh</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 pb-4 border-b border-muted">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Since:</label>
              <Input
                type="date"
                value={sinceDate}
                onChange={(e) => setSinceDate(e.target.value)}
                className="w-40 h-8"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">High confidence only:</label>
              <input
                type="checkbox"
                checked={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(e.target.checked)}
                className="rounded border-input"
              />
              <span className="text-xs text-muted-foreground">(90%+)</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Categories:</label>
              {CATEGORIES.map((cat) => (
                <label
                  key={cat.value}
                  className="flex items-center gap-1 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={categoryFilter.includes(cat.value)}
                    onChange={() => toggleCategory(cat.value)}
                    className="rounded border-input"
                  />
                  {cat.label}
                </label>
              ))}
            </div>
          </div>

          {/* Preview Table */}
          {loadingPreview ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-8 bg-muted/30 rounded animate-pulse"
                />
              ))}
            </div>
          ) : !preview || preview.items.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
              {mappings.length === 0
                ? "Configure account mappings above to see eligible transactions"
                : "No transactions eligible for write-back with current filters"}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {preview.totalTransactions} transaction
                  {preview.totalTransactions !== 1 ? "s" : ""} eligible for
                  write-back
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleSelectAll}
                  >
                    {selectedIds.size === preview.items.length
                      ? "Deselect All"
                      : "Select All"}
                  </Button>
                  {canAdmin && selectedIds.size > 0 && (
                    <Button
                      size="sm"
                      onClick={() => setConfirmOpen(true)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Upload size={14} className="mr-1" />
                      Push {selectedIds.size} to QuickBooks
                    </Button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-muted">
                      <th className="text-left py-2 w-8">
                        <input
                          type="checkbox"
                          checked={
                            preview.items.length > 0 &&
                            selectedIds.size === preview.items.length
                          }
                          onChange={toggleSelectAll}
                          className="rounded border-input"
                        />
                      </th>
                      <th className="text-left py-2 font-medium">Date</th>
                      <th className="text-left py-2 font-medium">Vendor</th>
                      <th className="text-right py-2 font-medium">Amount</th>
                      <th className="text-left py-2 font-medium">Category</th>
                      <th className="text-center py-2 font-medium">Conf.</th>
                      <th className="text-left py-2 font-medium">
                        Current Account
                      </th>
                      <th className="text-center py-2 font-medium"></th>
                      <th className="text-left py-2 font-medium">
                        Target Account
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.items.map((item) => (
                      <tr
                        key={item.transactionId}
                        className={cn(
                          "border-b border-muted/50 hover:bg-muted/20",
                          selectedIds.has(item.transactionId) && "bg-blue-500/5"
                        )}
                      >
                        <td className="py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.transactionId)}
                            onChange={() => toggleSelect(item.transactionId)}
                            className="rounded border-input"
                          />
                        </td>
                        <td className="py-2 whitespace-nowrap">
                          {formatDate(item.date)}
                        </td>
                        <td className="py-2 truncate max-w-[150px]">
                          {item.vendorName || "—"}
                        </td>
                        <td className="py-2 text-right font-mono">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="py-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              item.category === "business"
                                ? "border-green-500/30 text-green-400"
                                : item.category === "personal"
                                  ? "border-blue-500/30 text-blue-400"
                                  : "border-yellow-500/30 text-yellow-400"
                            )}
                          >
                            {item.category}
                          </Badge>
                        </td>
                        <td className="py-2 text-center">
                          <span
                            className={cn(
                              "text-xs font-medium",
                              item.confidence >= 90
                                ? "text-green-400"
                                : item.confidence >= 70
                                  ? "text-yellow-400"
                                  : "text-red-400"
                            )}
                          >
                            {item.confidence}%
                          </span>
                        </td>
                        <td className="py-2 truncate max-w-[140px] text-muted-foreground">
                          {item.currentAccountRef}
                        </td>
                        <td className="py-2 text-center">
                          <ArrowRightLeft
                            size={14}
                            className="text-muted-foreground mx-auto"
                          />
                        </td>
                        <td className="py-2 truncate max-w-[140px] font-medium text-blue-400">
                          {item.targetAccountRef}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent onClose={() => setConfirmOpen(false)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={20} className="text-amber-500" />
              Confirm Write-back
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm">
              This will update{" "}
              <strong>{selectedIds.size} transaction{selectedIds.size !== 1 ? "s" : ""}</strong>{" "}
              in QuickBooks Online. Each transaction&apos;s account will be
              re-assigned to the mapped target account.
            </p>
            <div className="rounded-md border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              <strong>Warning:</strong> This cannot be automatically undone. You
              would need to manually revert changes in QuickBooks if needed.
            </div>
            {executeWriteBackMutation.isError && (
              <div className="rounded-md border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                Error:{" "}
                {(executeWriteBackMutation.error as Error)?.message ||
                  "Unknown error"}
              </div>
            )}
            {executeWriteBackMutation.isSuccess && (
              <div className="space-y-2">
                <p className="text-sm text-green-400 flex items-center gap-1">
                  <CheckCircle2 size={14} />
                  Write-back completed!
                </p>
                <p className="text-sm">
                  Succeeded:{" "}
                  {(executeWriteBackMutation.data as { succeeded: number })?.succeeded},
                  Failed:{" "}
                  {(executeWriteBackMutation.data as { failed: number })?.failed}
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setConfirmOpen(false)}
                disabled={executeWriteBackMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700"
                onClick={() =>
                  executeWriteBackMutation.mutate(Array.from(selectedIds))
                }
                disabled={
                  executeWriteBackMutation.isPending ||
                  executeWriteBackMutation.isSuccess
                }
              >
                {executeWriteBackMutation.isPending
                  ? "Pushing..."
                  : "Push to QuickBooks"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Write-back History */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <History size={18} className="text-muted-foreground" />
          <CardTitle className="text-base">Write-back History</CardTitle>
        </CardHeader>
        <CardContent>
          {!historyData?.history || historyData.history.length === 0 ? (
            <div className="flex h-[100px] items-center justify-center text-sm text-muted-foreground">
              No write-back operations yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-muted">
                    <th className="text-left py-2 font-medium">Date</th>
                    <th className="text-right py-2 font-medium">Requested</th>
                    <th className="text-right py-2 font-medium">Succeeded</th>
                    <th className="text-right py-2 font-medium">Failed</th>
                    <th className="text-left py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.history.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-muted/50"
                    >
                      <td className="py-2">
                        {new Date(entry.createdAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2 text-right">
                        {entry.details.totalRequested}
                      </td>
                      <td className="py-2 text-right text-green-400">
                        {entry.details.succeeded}
                      </td>
                      <td className="py-2 text-right text-red-400">
                        {entry.details.failed}
                      </td>
                      <td className="py-2">
                        {entry.details.failed === 0 ? (
                          <Badge
                            variant="outline"
                            className="border-green-500/30 text-green-400"
                          >
                            <CheckCircle2 size={12} className="mr-1" />
                            Success
                          </Badge>
                        ) : entry.details.succeeded > 0 ? (
                          <Badge
                            variant="outline"
                            className="border-yellow-500/30 text-yellow-400"
                          >
                            <AlertTriangle size={12} className="mr-1" />
                            Partial
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-red-500/30 text-red-400"
                          >
                            <XCircle size={12} className="mr-1" />
                            Failed
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
