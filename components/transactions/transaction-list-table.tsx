"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTransactionsStore } from "@/lib/store/transactions-store";

export interface TransactionListRow {
  id: string;
  date: string;
  amount: string;
  vendorName: string | null;
  description: string | null;
  accountRef: string | null;
  category: string | null;
  confidence: number | null;
  catSource: string | null;
  reasoning: string | null;
}

interface TransactionListTableProps {
  data: TransactionListRow[];
}

function CategoryCell({ category, confidence }: { category: string | null; confidence: number | null }) {
  if (!category) {
    return <span className="text-xs text-muted-foreground">Uncategorized</span>;
  }
  const color =
    category === "business"
      ? "border-green-700 text-green-400"
      : category === "personal"
        ? "border-red-700 text-red-400"
        : "border-yellow-700 text-yellow-400";
  return (
    <Badge variant="outline" className={`capitalize text-xs ${color}`}>
      {category} {confidence !== null && `(${confidence}%)`}
    </Badge>
  );
}

export function TransactionListTable({ data }: TransactionListTableProps) {
  const { expandedId, toggleExpanded } = useTransactionsStore();

  const columns: ColumnDef<TransactionListRow>[] = [
    {
      id: "expand",
      header: "",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {expandedId === row.original.id ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
        </span>
      ),
      size: 30,
    },
    {
      accessorKey: "date",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Date <ArrowUpDown size={12} />
        </button>
      ),
      cell: ({ row }) => (
        <span className="text-xs">
          {new Date(row.getValue("date")).toLocaleDateString()}
        </span>
      ),
    },
    {
      accessorKey: "vendorName",
      header: "Vendor",
      cell: ({ row }) => (
        <span className="font-medium text-sm truncate max-w-[180px] block">
          {row.getValue("vendorName") || "Unknown"}
        </span>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground truncate max-w-[200px] block">
          {row.getValue("description") || "—"}
        </span>
      ),
    },
    {
      accessorKey: "amount",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Amount <ArrowUpDown size={12} />
        </button>
      ),
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("amount"));
        return (
          <span
            className={cn(
              "text-sm font-mono",
              amount < 0 ? "text-red-400" : "text-green-400"
            )}
          >
            ${Math.abs(amount).toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}
          </span>
        );
      },
    },
    {
      accessorKey: "accountRef",
      header: "Account",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.getValue("accountRef") || "—"}
        </span>
      ),
    },
    {
      accessorKey: "confidence",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Category <ArrowUpDown size={12} />
        </button>
      ),
      cell: ({ row }) => (
        <CategoryCell
          category={row.original.category}
          confidence={row.original.confidence}
        />
      ),
    },
    {
      accessorKey: "catSource",
      header: "Source",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground capitalize">
          {row.getValue("catSource") || "—"}
        </span>
      ),
    },
  ];

  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  });

  return (
    <div className="overflow-auto">
      <table className="w-full">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              key={headerGroup.id}
              className="border-b text-xs text-muted-foreground"
            >
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-3 py-2 text-left font-medium">
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
            <>
              <tr
                key={row.id}
                onClick={() => toggleExpanded(row.original.id)}
                className="cursor-pointer border-b border-border/50 transition-colors hover:bg-accent/50"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
              {expandedId === row.original.id && (
                <tr key={`${row.id}-detail`} className="border-b border-border/50 bg-muted/20">
                  <td colSpan={columns.length} className="px-6 py-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Description</span>
                        <p className="font-medium">
                          {row.original.description || "No description"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Account Ref</span>
                        <p className="font-medium">
                          {row.original.accountRef || "—"}
                        </p>
                      </div>
                      {row.original.reasoning && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Reasoning</span>
                          <p className="mt-1 rounded bg-muted/50 p-2 text-xs font-mono">
                            {row.original.reasoning}
                          </p>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
          {table.getRowModel().rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-8 text-center text-sm text-muted-foreground"
              >
                No transactions found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
