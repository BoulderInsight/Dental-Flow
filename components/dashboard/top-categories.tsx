"use client";

interface CategoryData {
  accountRef: string | null;
  total: string;
  count: number;
}

export function TopCategories({ data }: { data: CategoryData[] }) {
  if (data.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No category data available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((cat) => {
        const total = parseFloat(cat.total);
        return (
          <div key={cat.accountRef ?? "uncategorized"} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {cat.accountRef || "Uncategorized"}
              </span>
              <span className="text-xs text-muted-foreground">
                ({cat.count} txns)
              </span>
            </div>
            <span className="text-sm font-mono">
              ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
