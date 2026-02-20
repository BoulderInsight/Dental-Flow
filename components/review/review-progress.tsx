interface ReviewProgressProps {
  total: number;
  categorized: number;
  flagged: number;
}

export function ReviewProgress({
  total,
  categorized,
  flagged,
}: ReviewProgressProps) {
  const percent = total > 0 ? Math.round((categorized / total) * 100) : 0;

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
      <div className="flex-1">
        <div className="flex items-center justify-between text-sm mb-1">
          <span>
            {categorized} of {total} reviewed
          </span>
          <span className="text-muted-foreground">{percent}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      {flagged > 0 && (
        <div className="text-sm text-orange-400">
          {flagged} flagged
        </div>
      )}
    </div>
  );
}
