"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { FolderKanban, BarChart3, Sparkles, Settings } from "lucide-react";

const navItems = [
  { href: "/", label: "Projects", icon: FolderKanban },
  { href: "/usage", label: "Token Usage", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface UsageLimits {
  limits: {
    todayUsed: number;
    dailyLimit: number;
    percentUsed: number;
    todayRemaining: number;
  };
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function Sidebar() {
  const pathname = usePathname();

  const { data: usage } = useQuery<UsageLimits>({
    queryKey: ["usage-sidebar"],
    queryFn: () => fetch("/api/usage?period=today").then((r) => r.json()),
    refetchInterval: 60000,
  });

  return (
    <aside className="w-[260px] bg-[#111113] flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-[#5b5bd6] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-[15px] font-semibold text-white tracking-[-0.01em]">
              Task Manager
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5">
        <div className="px-2 pb-2 pt-1">
          <span className="text-[11px] font-medium text-[#6e6e80] uppercase tracking-widest">
            Menu
          </span>
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-100",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-[#9898a0] hover:bg-white/5 hover:text-[#ccccd0]"
              )}
            >
              <Icon className="w-[18px] h-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Token usage */}
      {usage?.limits && (
        <div className="px-3 pb-3">
          <Link href="/usage">
            <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-3 space-y-2 hover:bg-white/[0.06] transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#9898a0] uppercase tracking-wide">
                  Usage
                </span>
                <span className="text-[11px] font-mono font-medium text-[#9898a0]">
                  {usage.limits.percentUsed}%
                </span>
              </div>
              <div className="w-full h-1 bg-white/[0.08] rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    usage.limits.percentUsed > 80
                      ? "bg-[#e5484d]"
                      : usage.limits.percentUsed > 50
                      ? "bg-[#f76b15]"
                      : "bg-[#30a46c]"
                  )}
                  style={{ width: `${Math.min(usage.limits.percentUsed, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[#6e6e80]">
                <span>{formatTokens(usage.limits.todayUsed)} used</span>
                <span>{formatTokens(usage.limits.todayRemaining)} left</span>
              </div>
            </div>
          </Link>
        </div>
      )}

      <div className="px-5 py-3 border-t border-white/[0.06]">
        <span className="text-[11px] text-[#4e4e56]">v0.1.0</span>
      </div>
    </aside>
  );
}
