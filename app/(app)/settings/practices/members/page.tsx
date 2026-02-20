"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, UserPlus } from "lucide-react";

interface Member {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  invitedAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
}

interface PracticeItem {
  id: string;
  name: string;
  industry: string;
  role: string;
  isDefault: boolean;
}

export default function MembersPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"manager" | "accountant">(
    "manager"
  );

  // Get the current practice
  const { data: practices = [] } = useQuery<PracticeItem[]>({
    queryKey: ["practices"],
    queryFn: async () => {
      const res = await fetch("/api/practices");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const currentPractice = practices.find((p) => p.isDefault) ?? practices[0];
  const isOwner = currentPractice?.role === "owner";

  const { data: members = [], isLoading } = useQuery<Member[]>({
    queryKey: ["members", currentPractice?.id],
    queryFn: async () => {
      if (!currentPractice) return [];
      const res = await fetch(
        `/api/practices/${currentPractice.id}/members`
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!currentPractice,
  });

  const inviteMutation = useMutation({
    mutationFn: async ({
      email,
      role,
    }: {
      email: string;
      role: string;
    }) => {
      const res = await fetch(
        `/api/practices/${currentPractice!.id}/invite`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, role }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to invite");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Invitation sent");
      setInviteEmail("");
      queryClient.invalidateQueries({
        queryKey: ["members", currentPractice?.id],
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const res = await fetch(
        `/api/practices/${currentPractice!.id}/members?membershipId=${membershipId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove");
      }
    },
    onSuccess: () => {
      toast.success("Member removed");
      queryClient.invalidateQueries({
        queryKey: ["members", currentPractice?.id],
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
  }

  function handleRemove(member: Member) {
    if (
      !confirm(
        `Remove ${member.name} (${member.email}) from this practice?`
      )
    ) {
      return;
    }
    removeMutation.mutate(member.id);
  }

  const roleColors: Record<string, string> = {
    owner: "text-blue-400 border-blue-700",
    manager: "text-purple-400 border-purple-700",
    accountant: "text-emerald-400 border-emerald-700",
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Practice Members</h1>
        <p className="text-muted-foreground mt-1">
          Manage who has access to{" "}
          {currentPractice?.name ?? "your practice"}.
        </p>
      </div>

      {isOwner && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
            <UserPlus size={16} />
            Invite Member
          </h2>
          <form onSubmit={handleInvite} className="flex gap-3 items-end">
            <div className="flex-1 space-y-1">
              <label htmlFor="invite-email" className="text-xs text-muted-foreground">
                Email
              </label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <div className="w-36 space-y-1">
              <label htmlFor="invite-role" className="text-xs text-muted-foreground">
                Role
              </label>
              <Select
                id="invite-role"
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value as "manager" | "accountant")
                }
              >
                <option value="manager">Manager</option>
                <option value="accountant">Accountant</option>
              </Select>
            </div>
            <Button
              type="submit"
              disabled={inviteMutation.isPending}
              className="shrink-0"
            >
              {inviteMutation.isPending ? "Inviting..." : "Invite"}
            </Button>
          </form>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Loading members...
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                {isOwner && (
                  <th className="px-4 py-3 text-right font-medium" />
                )}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr
                  key={member.id}
                  className="border-b border-border/50 hover:bg-accent/50"
                >
                  <td className="px-4 py-3 text-sm font-medium">
                    {member.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {member.email}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={`capitalize ${roleColors[member.role] ?? ""}`}
                    >
                      {member.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {member.acceptedAt ? (
                      <Badge
                        variant="outline"
                        className="text-green-400 border-green-700"
                      >
                        Active
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-yellow-400 border-yellow-700"
                      >
                        Pending
                      </Badge>
                    )}
                  </td>
                  {isOwner && (
                    <td className="px-4 py-3 text-right">
                      {member.userId !== session?.user?.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemove(member)}
                          disabled={removeMutation.isPending}
                        >
                          <Trash2 size={14} className="text-red-400" />
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td
                    colSpan={isOwner ? 5 : 4}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    No members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
