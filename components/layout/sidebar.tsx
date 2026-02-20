"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/lib/hooks/use-permissions";
import {
  LayoutDashboard,
  Receipt,
  ClipboardCheck,
  DollarSign,
  TrendingUp,
  Network,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Link2,
  Factory,
} from "lucide-react";
import { useState } from "react";
import { PracticeSwitcher } from "./practice-switcher";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, requireWrite: false },
  { href: "/transactions", label: "Transactions", icon: Receipt, requireWrite: false },
  { href: "/review", label: "Review", icon: ClipboardCheck, requireWrite: false },
  { href: "/finance", label: "Financials", icon: DollarSign, requireWrite: false },
  { href: "/finance/net-worth", label: "Net Worth", icon: Wallet, requireWrite: false },
  { href: "/forecast", label: "Forecast", icon: TrendingUp, requireWrite: false },
  { href: "/settings/rules", label: "Rules", icon: Settings, requireWrite: true },
  { href: "/settings/industry", label: "Industry", icon: Factory, requireWrite: true },
  { href: "/settings/accounts", label: "Accounts", icon: Link2, requireWrite: true },
  { href: "/settings/practices/members", label: "Members", icon: Users, requireWrite: false },
  { href: "/architecture", label: "Architecture", icon: Network, requireWrite: false },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { canWrite } = usePermissions();

  const visibleNavItems = navItems.filter(
    (item) => !item.requireWrite || canWrite
  );

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <div className="flex flex-col border-b border-sidebar-border">
        <div className="flex h-14 items-center px-4">
          {!collapsed && (
            <Link href="/" className="flex items-center gap-2">
              <span className="text-lg font-bold text-sidebar-primary">
                DentalFlow
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                Pro
              </span>
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              collapsed ? "mx-auto" : "ml-auto"
            )}
          >
            {collapsed ? (
              <ChevronRight size={16} />
            ) : (
              <ChevronLeft size={16} />
            )}
          </button>
        </div>
        {!collapsed && (
          <div className="px-3 pb-3">
            <PracticeSwitcher />
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {visibleNavItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon size={18} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
