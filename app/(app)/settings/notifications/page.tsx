"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Bell, Mail, Calendar, TrendingUp, Users, FileText } from "lucide-react";

interface NotificationPreferences {
  id: string;
  emailInvites: boolean;
  emailTaxAlerts: boolean;
  emailMonthlyDigest: boolean;
  emailReferralOpportunities: boolean;
  emailWeeklyInsights: boolean;
}

interface ToggleRowProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  description: string;
  frequency?: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  isPending: boolean;
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  frequency,
  enabled,
  onToggle,
  isPending,
}: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/50 px-4 py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-muted-foreground">
          <Icon size={18} />
        </span>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          {frequency && (
            <p className="text-xs text-blue-400 mt-1">{frequency}</p>
          )}
        </div>
      </div>
      <button
        onClick={() => onToggle(!enabled)}
        disabled={isPending}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
          enabled ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export default function NotificationSettingsPage() {
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ["notification-preferences"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/preferences");
      if (!res.ok) throw new Error("Failed to load preferences");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["notification-preferences"], data);
      toast.success("Preference updated");
    },
    onError: () => toast.error("Failed to update preference"),
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notification Preferences</h1>
        <p className="text-muted-foreground mt-1">
          Choose which email notifications you receive
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-20 bg-muted/30 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : prefs ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell size={18} />
              Email Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow
              icon={Users}
              label="Practice Invitations"
              description="Receive emails when invited to join a practice"
              enabled={prefs.emailInvites}
              onToggle={(v) => updateMutation.mutate({ emailInvites: v })}
              isPending={updateMutation.isPending}
            />
            <ToggleRow
              icon={FileText}
              label="Tax Alerts"
              description="Get notified about new tax-saving opportunities"
              enabled={prefs.emailTaxAlerts}
              onToggle={(v) => updateMutation.mutate({ emailTaxAlerts: v })}
              isPending={updateMutation.isPending}
            />
            <ToggleRow
              icon={Calendar}
              label="Monthly Digest"
              description="Monthly financial summary with revenue, profit, and key metrics"
              frequency="Sent on the 1st of each month"
              enabled={prefs.emailMonthlyDigest}
              onToggle={(v) => updateMutation.mutate({ emailMonthlyDigest: v })}
              isPending={updateMutation.isPending}
            />
            <ToggleRow
              icon={TrendingUp}
              label="Referral Opportunities"
              description="Get notified about detected savings opportunities"
              enabled={prefs.emailReferralOpportunities}
              onToggle={(v) =>
                updateMutation.mutate({ emailReferralOpportunities: v })
              }
              isPending={updateMutation.isPending}
            />
            <ToggleRow
              icon={Mail}
              label="Weekly Insights"
              description="Weekly summary of transactions, cash position, and upcoming deadlines"
              frequency="Sent every Monday morning"
              enabled={prefs.emailWeeklyInsights}
              onToggle={(v) =>
                updateMutation.mutate({ emailWeeklyInsights: v })
              }
              isPending={updateMutation.isPending}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bell size={48} className="text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">
              Unable to load preferences
            </p>
            <p className="text-sm text-muted-foreground">
              Please try refreshing the page
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
