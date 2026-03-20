import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET — get sessions for a task (latest first)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const sessions = await prisma.claudeSession.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Failed to fetch sessions:", error);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}

// POST — create a new session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const body = await request.json();
    const { prompt } = body;

    const session = await prisma.claudeSession.create({
      data: {
        taskId,
        prompt: prompt || "",
        status: "running",
      },
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error("Failed to create session:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}

// PUT — update a session (append output, change status)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const body = await request.json();
    const { sessionId, output, status, appendOutput } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};

    if (status) updateData.status = status;

    if (appendOutput) {
      // Append to existing output
      const existing = await prisma.claudeSession.findUnique({
        where: { id: sessionId },
      });
      updateData.output = (existing?.output || "") + appendOutput;
    } else if (output !== undefined) {
      updateData.output = output;
    }

    const session = await prisma.claudeSession.update({
      where: { id: sessionId },
      data: updateData,
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error("Failed to update session:", error);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}
