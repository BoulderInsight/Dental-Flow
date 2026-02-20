import { ReviewPanel } from "@/components/review/review-panel";

export default function ReviewPage() {
  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Transaction Review</h1>
        <p className="text-muted-foreground mt-1">
          Review and categorize flagged transactions. Sorted by confidence
          (lowest first).
        </p>
      </div>
      <ReviewPanel />
    </div>
  );
}
