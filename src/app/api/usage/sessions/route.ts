import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const where: Record<string, unknown> = {};
    if (projectId) {
      where.task = { projectId };
    }

    const sessions = await prisma.claudeSession.findMany({
      where,
      include: {
        task: {
          select: {
            id: true,
            title: true,
            projectId: true,
            project: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const totalTokens = sessions.reduce(
      (acc, s) => ({
        input: acc.input + s.inputTokens,
        output: acc.output + s.outputTokens,
      }),
      { input: 0, output: 0 }
    );

    return NextResponse.json({ sessions, totalTokens });
  } catch (error) {
    console.error("Failed to fetch sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}
