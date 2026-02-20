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
  Scale,
  Landmark,
  Percent,
  BadgeDollarSign,
  FileText,
  Calculator,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { PracticeSwitcher } from "./practice-switcher";

interface NavSection {
  label: string;
  items: Array<{
    href: string;
    label: string;
    icon: React.ComponentType<{ size?: number }>;
    requireWrite: boolean;
  }>;
}

const navSections: NavSection[] = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, requireWrite: false },
      { href: "/transactions", label: "Transactions", icon: Receipt, requireWrite: false },
      { href: "/review", label: "Review", icon: ClipboardCheck, requireWrite: false },
    ],
  },
  {
    label: "Reports",
    items: [
      { href: "/finance", label: "Financials", icon: DollarSign, requireWrite: false },
      { href: "/finance/net-worth", label: "Net Worth", icon: Wallet, requireWrite: false },
      { href: "/forecast", label: "Forecast", icon: TrendingUp, requireWrite: false },
    ],
  },
  {
    label: "Advisory",
    items: [
      { href: "/finance/debt-capacity", label: "Debt Capacity", icon: Scale, requireWrite: false },
      { href: "/finance/loans", label: "Loans", icon: Landmark, requireWrite: false },
      { href: "/finance/cost-of-capital", label: "Cost of Capital", icon: Percent, requireWrite: false },
      { href: "/finance/valuation", label: "Valuation", icon: BadgeDollarSign, requireWrite: false },
      { href: "/finance/tax-strategy", label: "Tax Strategy", icon: FileText, requireWrite: false },
      { href: "/finance/roi", label: "ROI Calculator", icon: Calculator, requireWrite: false },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/settings/rules", label: "Rules", icon: Settings, requireWrite: true },
      { href: "/settings/industry", label: "Industry", icon: Factory, requireWrite: true },
      { href: "/settings/accounts", label: "Accounts", icon: Link2, requireWrite: true },
      { href: "/settings/qbo-sync", label: "QBO Sync", icon: RefreshCw, requireWrite: true },
      { href: "/settings/practices/members", label: "Members", icon: Users, requireWrite: false },
      { href: "/architecture", label: "Architecture", icon: Network, requireWrite: false },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { canWrite } = usePermissions();

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
                CFO Pro
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

      <nav className="flex-1 overflow-y-auto p-2">
        {navSections.map((section) => {
          const visibleItems = section.items.filter(
            (item) => !item.requireWrite || canWrite
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.label} className="mb-3">
              {!collapsed && (
                <p className="mb-1 px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
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
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
