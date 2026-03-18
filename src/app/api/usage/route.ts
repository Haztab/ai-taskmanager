import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const period = searchParams.get("period") || "today"; // today, week, month, all

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "month":
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      default:
        startDate = new Date(0);
    }

    const where: Record<string, unknown> = {
      createdAt: { gte: startDate },
    };
    if (projectId) {
      where.projectId = projectId;
    }

    // Aggregate usage
    const usage = await prisma.tokenUsage.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const totals = usage.reduce(
      (acc, u) => ({
        inputTokens: acc.inputTokens + u.inputTokens,
        outputTokens: acc.outputTokens + u.outputTokens,
        totalTokens: acc.totalTokens + u.inputTokens + u.outputTokens,
      }),
      { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
    );

    const bySource = usage.reduce(
      (acc, u) => {
        if (!acc[u.source]) {
          acc[u.source] = { inputTokens: 0, outputTokens: 0, count: 0 };
        }
        acc[u.source].inputTokens += u.inputTokens;
        acc[u.source].outputTokens += u.outputTokens;
        acc[u.source].count += 1;
        return acc;
      },
      {} as Record<string, { inputTokens: number; outputTokens: number; count: number }>
    );

    // Daily breakdown for charts
    const dailyUsage = usage.reduce(
      (acc, u) => {
        const day = u.createdAt.toISOString().split("T")[0];
        if (!acc[day]) {
          acc[day] = { inputTokens: 0, outputTokens: 0 };
        }
        acc[day].inputTokens += u.inputTokens;
        acc[day].outputTokens += u.outputTokens;
        return acc;
      },
      {} as Record<string, { inputTokens: number; outputTokens: number }>
    );

    // Claude Code Max limits (approximate - varies by plan)
    // Max plan: ~45M tokens/day for Opus, higher for Sonnet
    const dailyLimit = parseInt(
      process.env.CLAUDE_MAX_DAILY_TOKENS || "5000000",
      10
    );
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayUsage = usage
      .filter((u) => u.createdAt >= todayStart)
      .reduce((acc, u) => acc + u.inputTokens + u.outputTokens, 0);

    return NextResponse.json({
      totals,
      bySource,
      dailyUsage,
      limits: {
        dailyLimit,
        todayUsed: todayUsage,
        todayRemaining: Math.max(0, dailyLimit - todayUsage),
        percentUsed: dailyLimit > 0 ? Math.round((todayUsage / dailyLimit) * 100) : 0,
      },
      recentEntries: usage.slice(0, 20),
    });
  } catch (error) {
    console.error("Failed to fetch usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage" },
      { status: 500 }
    );
  }
}
