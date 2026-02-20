"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

interface Rule {
  id: string;
  matchType: string;
  matchValue: string;
  category: string;
  priority: number;
  createdAt: string;
}

export default function RulesPage() {
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading } = useQuery<Rule[]>({
    queryKey: ["rules"],
    queryFn: async () => {
      const res = await fetch("/api/rules");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/rules/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      toast.success("Rule deleted");
      queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
    onError: () => toast.error("Failed to delete rule"),
  });

  const columns: ColumnDef<Rule>[] = [
    {
      accessorKey: "matchType",
      header: "Match Type",
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.getValue("matchType")}
        </Badge>
      ),
    },
    {
      accessorKey: "matchValue",
      header: "Match Value",
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.getValue("matchValue")}</span>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => {
        const cat = row.getValue("category") as string;
        const color =
          cat === "business"
            ? "text-green-400 border-green-700"
            : cat === "personal"
              ? "text-red-400 border-red-700"
              : "text-yellow-400 border-yellow-700";
        return (
          <Badge variant="outline" className={`capitalize ${color}`}>
            {cat}
          </Badge>
        );
      },
    },
    {
      accessorKey: "priority",
      header: "Priority",
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.getValue("createdAt")).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => deleteMutation.mutate(row.original.id)}
          disabled={deleteMutation.isPending}
        >
          <Trash2 size={14} className="text-red-400" />
        </Button>
      ),
    },
  ];

  const table = useReactTable({
    data: rules,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Categorization Rules</h1>
        <p className="text-muted-foreground mt-1">
          Manage auto-categorization rules for your practice. Rules are checked
          before all other matching logic.
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Loading rules...
          </div>
        ) : (
          <table className="w-full">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className="border-b text-xs text-muted-foreground"
                >
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left font-medium"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border/50 hover:bg-accent/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    No rules yet. Rules are auto-created when you categorize the
                    same vendor twice.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
