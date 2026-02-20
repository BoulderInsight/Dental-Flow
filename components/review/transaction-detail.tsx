"use client";

import { Separator } from "@/components/ui/separator";
import { CategoryBadge } from "./category-badge";
import { CategoryActions } from "./category-actions";

interface TransactionData {
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

interface TransactionDetailProps {
  transaction: TransactionData | null;
}

export function TransactionDetail({ transaction }: TransactionDetailProps) {
  if (!transaction) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Select a transaction to view details
      </div>
    );
  }

  const amount = parseFloat(transaction.amount);
  const isNegative = amount < 0;

  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="text-lg font-semibold">
          {transaction.vendorName || "Unknown Vendor"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {transaction.description || "No description"}
        </p>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">Date</span>
          <p className="font-medium">
            {new Date(transaction.date).toLocaleDateString()}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">Amount</span>
          <p
            className={`font-medium ${isNegative ? "text-red-400" : "text-green-400"}`}
          >
            {isNegative ? "-" : "+"}$
            {Math.abs(amount).toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">Account</span>
          <p className="font-medium">{transaction.accountRef || "—"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Category</span>
          <div className="mt-0.5">
            <CategoryBadge
              category={transaction.category}
              confidence={transaction.confidence}
            />
          </div>
        </div>
      </div>

      {transaction.reasoning && (
        <>
          <Separator />
          <div className="text-sm">
            <span className="text-muted-foreground">Rule Reasoning</span>
            <p className="mt-1 rounded bg-muted/50 p-2 text-xs font-mono">
              {transaction.reasoning}
            </p>
            {transaction.catSource && (
              <p className="mt-1 text-xs text-muted-foreground">
                Source: {transaction.catSource}
              </p>
            )}
          </div>
        </>
      )}

      <Separator />

      <div>
        <p className="text-sm text-muted-foreground mb-2">
          Categorize as:
        </p>
        <CategoryActions
          transactionId={transaction.id}
          currentCategory={transaction.category}
        />
      </div>
    </div>
  );
}
