"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Projects", icon: "📁" },
  { href: "/usage", label: "Token Usage", icon: "📊" },
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
    <aside className="w-64 border-r bg-card flex flex-col h-full">
      <div className="p-6 border-b">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-sm font-bold">AI</span>
          </div>
          <span className="font-semibold text-lg">Task Manager</span>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              pathname === item.href
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Token usage widget */}
      {usage?.limits && (
        <div className="px-4 pb-2">
          <Link href="/usage">
            <div className="rounded-lg border p-3 space-y-2 hover:bg-accent/50 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Claude Code Max</span>
                <span className="text-xs text-muted-foreground">
                  {usage.limits.percentUsed}%
                </span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    usage.limits.percentUsed > 80
                      ? "bg-red-500"
                      : usage.limits.percentUsed > 50
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  )}
                  style={{
                    width: `${Math.min(usage.limits.percentUsed, 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{formatTokens(usage.limits.todayUsed)} used</span>
                <span>{formatTokens(usage.limits.todayRemaining)} left</span>
              </div>
            </div>
          </Link>
        </div>
      )}

      <div className="p-4 border-t">
        <div className="text-xs text-muted-foreground">
          AI Task Manager v0.1
        </div>
      </div>
    </aside>
  );
}
