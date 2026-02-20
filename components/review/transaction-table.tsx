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
import { CategoryBadge } from "./category-badge";
import { cn } from "@/lib/utils";
import { ArrowUpDown } from "lucide-react";

export interface TransactionRow {
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

interface TransactionTableProps {
  data: TransactionRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const columns: ColumnDef<TransactionRow>[] = [
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
      <CategoryBadge
        category={row.original.category}
        confidence={row.original.confidence}
      />
    ),
  },
];

export function TransactionTable({
  data,
  selectedId,
  onSelect,
}: TransactionTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "confidence", desc: false },
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
            <tr
              key={row.id}
              onClick={() => onSelect(row.original.id)}
              className={cn(
                "cursor-pointer border-b border-border/50 transition-colors hover:bg-accent/50",
                selectedId === row.original.id && "bg-accent"
              )}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
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
