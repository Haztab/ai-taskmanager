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
            <Card className="border-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    Claude Code Max - Daily Usage
                  </CardTitle>
                  <Badge
                    variant={
                      usage.limits.percentUsed > 80
                        ? "destructive"
                        : usage.limits.percentUsed > 50
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {usage.limits.percentUsed}% used
                  </Badge>
                </div>
                <CardDescription>
                  Resets daily. Configure limit via CLAUDE_MAX_DAILY_TOKENS env var.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Progress bar */}
                <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      usage.limits.percentUsed > 80
                        ? "bg-red-500"
                        : usage.limits.percentUsed > 50
                        ? "bg-yellow-500"
                        : "bg-green-500"
                    }`}
                    style={{ width: `${Math.min(usage.limits.percentUsed, 100)}%` }}
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
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Tokens</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatTokens(usage.totals.totalTokens)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Input Tokens</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatTokens(usage.totals.inputTokens)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Output Tokens</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatTokens(usage.totals.outputTokens)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>API Calls</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Object.values(usage.bySource).reduce(
                      (sum, s) => sum + s.count,
                      0
                    )}
                  </div>
                </CardContent>
              </Card>
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
                      <div>
                        <span className="text-muted-foreground">Input: </span>
                        <strong>{formatTokens(data.inputTokens)}</strong>
                      </div>
                      <div>
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
            <CardHeader>
              <CardTitle className="text-base">Recent Claude Code Sessions</CardTitle>
              <CardDescription>
                Total: {formatTokens(sessionData.totalTokens.input)} input +{" "}
                {formatTokens(sessionData.totalTokens.output)} output
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sessionData.sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between border-b pb-3 last:border-0"
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
                      <div>
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
