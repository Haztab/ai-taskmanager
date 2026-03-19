"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, ArrowDownLeft, ArrowUpRight, Zap } from "lucide-react";

interface UsageData {
  totals: { inputTokens: number; outputTokens: number; totalTokens: number };
  bySource: Record<
    string,
    { inputTokens: number; outputTokens: number; count: number }
  >;
  dailyUsage: Record<string, { inputTokens: number; outputTokens: number }>;
  limits: {
    dailyLimit: number;
    todayUsed: number;
    todayRemaining: number;
    percentUsed: number;
  };
  recentEntries: {
    id: string;
    source: string;
    inputTokens: number;
    outputTokens: number;
    model: string | null;
    createdAt: string;
  }[];
}

interface SessionData {
  sessions: {
    id: string;
    prompt: string;
    plan: string | null;
    status: string;
    inputTokens: number;
    outputTokens: number;
    createdAt: string;
    task: {
      id: string;
      title: string;
      projectId: string;
      project: { name: string };
    };
  }[];
  totalTokens: { input: number; output: number };
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const statCards = [
  {
    key: "totalTokens",
    label: "Total Tokens",
    icon: Activity,
    color: "blue",
    borderColor: "border-l-blue-500",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
  },
  {
    key: "inputTokens",
    label: "Input Tokens",
    icon: ArrowDownLeft,
    color: "green",
    borderColor: "border-l-emerald-500",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
  },
  {
    key: "outputTokens",
    label: "Output Tokens",
    icon: ArrowUpRight,
    color: "orange",
    borderColor: "border-l-orange-500",
    iconBg: "bg-orange-500/10",
    iconColor: "text-orange-500",
  },
  {
    key: "apiCalls",
    label: "API Calls",
    icon: Zap,
    color: "purple",
    borderColor: "border-l-purple-500",
    iconBg: "bg-purple-500/10",
    iconColor: "text-purple-500",
  },
] as const;

export default function UsagePage() {
  const [period, setPeriod] = useState("today");

  const { data: usage, isLoading } = useQuery<UsageData>({
    queryKey: ["usage", period],
    queryFn: () =>
      fetch(`/api/usage?period=${period}`).then((r) => r.json()),
    refetchInterval: 30000,
  });

  const { data: sessionData } = useQuery<SessionData>({
    queryKey: ["usage-sessions"],
    queryFn: () =>
      fetch("/api/usage/sessions?limit=20").then((r) => r.json()),
  });

  const getStatValue = (key: string) => {
    if (!usage) return "0";
    if (key === "totalTokens") return formatTokens(usage.totals.totalTokens);
    if (key === "inputTokens") return formatTokens(usage.totals.inputTokens);
    if (key === "outputTokens") return formatTokens(usage.totals.outputTokens);
    if (key === "apiCalls")
      return String(
        Object.values(usage.bySource).reduce((sum, s) => sum + s.count, 0)
      );
    return "0";
  };

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Token Usage"
        breadcrumbs={[{ label: "Usage" }]}
        actions={
          <Select value={period} onValueChange={(v) => setPeriod(v ?? "today")}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Daily Limit Progress */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-20" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : usage ? (
          <>
            {/* Limit card - prominent */}
            <Card className="border-2 overflow-hidden">
              <CardHeader className="pb-3 bg-gradient-to-r from-muted/50 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20">
                      <Activity className="h-5 w-5 text-violet-500" />
                    </div>
                    <CardTitle className="text-lg">
                      Claude Code Max - Daily Usage
                    </CardTitle>
                  </div>
                  <Badge
                    variant={
                      usage.limits.percentUsed > 80
                        ? "destructive"
                        : usage.limits.percentUsed > 50
                        ? "secondary"
                        : "outline"
                    }
                    className="text-sm px-3 py-1"
                  >
                    {usage.limits.percentUsed}% used
                  </Badge>
                </div>
                <CardDescription className="ml-12">
                  Resets daily. Configure limit via CLAUDE_MAX_DAILY_TOKENS env var.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {/* Animated progress bar */}
                <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-green-500 via-emerald-400 to-green-500 bg-[length:200%_100%] animate-[shimmer_2s_infinite]"
                    style={{
                      width: `${Math.min(usage.limits.percentUsed, 100)}%`,
                      backgroundImage:
                        usage.limits.percentUsed > 80
                          ? "linear-gradient(90deg, #ef4444, #f87171, #ef4444)"
                          : usage.limits.percentUsed > 50
                          ? "linear-gradient(90deg, #eab308, #facc15, #eab308)"
                          : "linear-gradient(90deg, #22c55e, #4ade80, #22c55e)",
                    }}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Used: <strong>{formatTokens(usage.limits.todayUsed)}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    Remaining:{" "}
                    <strong>{formatTokens(usage.limits.todayRemaining)}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    Limit:{" "}
                    <strong>{formatTokens(usage.limits.dailyLimit)}</strong>
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Stats cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {statCards.map((stat) => {
                const Icon = stat.icon;
                return (
                  <Card
                    key={stat.key}
                    className={`border-l-4 ${stat.borderColor}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardDescription>{stat.label}</CardDescription>
                        <div className={`p-1.5 rounded-md ${stat.iconBg}`}>
                          <Icon className={`h-4 w-4 ${stat.iconColor}`} />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {getStatValue(stat.key)}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Usage by source */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(usage.bySource).map(([source, data]) => (
                <Card key={source}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Badge variant="outline">
                        {source === "api" ? "Anthropic API" : "Claude Code CLI"}
                      </Badge>
                      <span className="text-muted-foreground text-sm">
                        {data.count} calls
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-6 text-sm">
                      <div className="flex items-center gap-1.5">
                        <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-muted-foreground">Input: </span>
                        <strong>{formatTokens(data.inputTokens)}</strong>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ArrowUpRight className="h-3.5 w-3.5 text-orange-500" />
                        <span className="text-muted-foreground">Output: </span>
                        <strong>{formatTokens(data.outputTokens)}</strong>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        ) : null}

        {/* Recent sessions */}
        {sessionData && sessionData.sessions.length > 0 && (
          <Card>
            <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
                  <Zap className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Recent Claude Code Sessions</CardTitle>
                  <CardDescription>
                    Total: {formatTokens(sessionData.totalTokens.input)} input +{" "}
                    {formatTokens(sessionData.totalTokens.output)} output
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-1">
                {sessionData.sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-transparent hover:border-border hover:bg-muted/50 transition-all duration-150 cursor-default"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant={
                            session.status === "completed"
                              ? "default"
                              : session.status === "running"
                              ? "secondary"
                              : "destructive"
                          }
                          className="text-xs"
                        >
                          {session.status}
                        </Badge>
                        <span className="text-sm font-medium truncate">
                          {session.task.title}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {session.prompt}
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground ml-4 shrink-0">
                      <div className="font-medium">
                        {formatTokens(session.inputTokens + session.outputTokens)} tokens
                      </div>
                      <div>
                        {new Date(session.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
