"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface TransactionData {
  date: string;
  vendorName: string | null;
  description: string | null;
  amount: string;
  accountRef: string | null;
  category: string | null;
  confidence: number | null;
  catSource: string | null;
}

export function ExportButton({ data }: { data: TransactionData[] }) {
  function handleExport() {
    const headers = [
      "Date",
      "Vendor",
      "Description",
      "Amount",
      "Account",
      "Category",
      "Confidence",
      "Source",
    ];

    const rows = data.map((t) => [
      new Date(t.date).toLocaleDateString(),
      t.vendorName || "",
      t.description || "",
      t.amount,
      t.accountRef || "",
      t.category || "",
      t.confidence?.toString() || "",
      t.catSource || "",
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dentalflow-transactions-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button size="sm" variant="outline" onClick={handleExport} disabled={data.length === 0}>
      <Download size={14} className="mr-1.5" />
      Export CSV
    </Button>
  );
}
