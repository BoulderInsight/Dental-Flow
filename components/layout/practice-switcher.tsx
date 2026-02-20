"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChevronDown, Plus, Building2, Check } from "lucide-react";
import { toast } from "sonner";

interface PracticeItem {
  id: string;
  name: string;
  industry: string;
  role: string;
  isDefault: boolean;
}

export function PracticeSwitcher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: practices = [] } = useQuery<PracticeItem[]>({
    queryKey: ["practices"],
    queryFn: async () => {
      const res = await fetch("/api/practices");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const currentPractice = practices.find((p) => p.isDefault) ?? practices[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSwitch(practiceId: string) {
    if (practiceId === currentPractice?.id) {
      setOpen(false);
      return;
    }

    setSwitching(true);
    try {
      const res = await fetch("/api/auth/switch-practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ practiceId }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to switch practice");
        return;
      }

      // Reload to refresh JWT session
      window.location.reload();
    } catch {
      toast.error("Failed to switch practice");
    } finally {
      setSwitching(false);
      setOpen(false);
    }
  }

  if (!currentPractice) return null;

  const roleColors: Record<string, string> = {
    owner: "text-blue-400 border-blue-700",
    manager: "text-purple-400 border-purple-700",
    accountant: "text-emerald-400 border-emerald-700",
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        onClick={() => setOpen(!open)}
        disabled={switching}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          switching && "opacity-50"
        )}
      >
        <Building2 size={16} className="shrink-0 text-muted-foreground" />
        <div className="flex-1 truncate">
          <div className="truncate font-medium">{currentPractice.name}</div>
          <div className="text-xs text-muted-foreground capitalize">
            {currentPractice.industry}
          </div>
        </div>
        <ChevronDown
          size={14}
          className={cn(
            "shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[200px] rounded-md border bg-popover p-1 shadow-md">
          {practices.map((practice) => (
            <button
              key={practice.id}
              onClick={() => handleSwitch(practice.id)}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent"
            >
              <div className="flex-1 text-left">
                <div className="truncate font-medium">{practice.name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-1.5 py-0 capitalize",
                      roleColors[practice.role] ?? ""
                    )}
                  >
                    {practice.role}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground capitalize">
                    {practice.industry}
                  </span>
                </div>
              </div>
              {practice.id === currentPractice.id && (
                <Check size={14} className="shrink-0 text-primary" />
              )}
            </button>
          ))}

          <div className="my-1 border-t" />

          <button
            onClick={() => {
              setOpen(false);
              router.push("/settings/practices/new");
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Plus size={14} />
            <span>Add Practice</span>
          </button>
        </div>
      )}
    </div>
  );
}
