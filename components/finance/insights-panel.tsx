"use client";

import { cn } from "@/lib/utils";
import { Info, AlertTriangle, CheckCircle } from "lucide-react";

interface Insight {
  type: "info" | "warning" | "success";
  text: string;
}

export function InsightsPanel({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Quick Insights
      </h3>
      {insights.map((insight, i) => (
        <div
          key={i}
          className={cn(
            "flex items-start gap-3 rounded-md border p-3 text-sm",
            insight.type === "warning" && "border-yellow-500/30 bg-yellow-500/5",
            insight.type === "success" && "border-green-500/30 bg-green-500/5",
            insight.type === "info" && "border-blue-500/30 bg-blue-500/5"
          )}
        >
          {insight.type === "warning" && (
            <AlertTriangle size={16} className="text-yellow-400 mt-0.5 shrink-0" />
          )}
          {insight.type === "success" && (
            <CheckCircle size={16} className="text-green-400 mt-0.5 shrink-0" />
          )}
          {insight.type === "info" && (
            <Info size={16} className="text-blue-400 mt-0.5 shrink-0" />
          )}
          <span>{insight.text}</span>
        </div>
      ))}
    </div>
  );
}
