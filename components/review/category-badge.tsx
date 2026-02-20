import { cn } from "@/lib/utils";

interface CategoryBadgeProps {
  category: string | null;
  confidence: number | null;
}

export function CategoryBadge({ category, confidence }: CategoryBadgeProps) {
  if (!category) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
        Uncategorized
      </span>
    );
  }

  const colorClass =
    category === "business" && confidence !== null && confidence >= 90
      ? "bg-green-900/50 text-green-400 border-green-700"
      : category === "business"
        ? "bg-yellow-900/50 text-yellow-400 border-yellow-700"
        : category === "personal" && confidence !== null && confidence >= 90
          ? "bg-red-900/50 text-red-400 border-red-700"
          : category === "personal"
            ? "bg-yellow-900/50 text-yellow-400 border-yellow-700"
            : "bg-orange-900/50 text-orange-400 border-orange-700";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        colorClass
      )}
    >
      {category}
      {confidence !== null && (
        <span className="opacity-70">{confidence}%</span>
      )}
    </span>
  );
}
