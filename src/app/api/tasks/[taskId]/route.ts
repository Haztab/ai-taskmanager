import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        epic: true,
        workstream: true,
        dependencies: {
          include: { dependency: true },
        },
        dependents: {
          include: { dependent: true },
        },
        sessions: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("Failed to fetch task:", error);
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const body = await request.json();
    const {
      title,
      description,
      userStory,
      acceptanceCriteria,
      status,
      priority,
      estimatedEffort,
      sortOrder,
      epicId,
      workstreamId,
      branchName,
      worktreePath,
    } = body;

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (userStory !== undefined) data.userStory = userStory;
    if (acceptanceCriteria !== undefined)
      data.acceptanceCriteria = typeof acceptanceCriteria === "string" ? acceptanceCriteria : JSON.stringify(acceptanceCriteria);
    if (status !== undefined) data.status = status;
    if (priority !== undefined) data.priority = priority;
    if (estimatedEffort !== undefined) data.estimatedEffort = estimatedEffort;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;
    if (epicId !== undefined) data.epicId = epicId;
    if (workstreamId !== undefined) data.workstreamId = workstreamId;
    if (branchName !== undefined) data.branchName = branchName;
    if (worktreePath !== undefined) data.worktreePath = worktreePath;

    const task = await prisma.task.update({
      where: { id: taskId },
      data,
      include: {
        epic: true,
        workstream: true,
      },
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error("Failed to update task:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    await prisma.task.delete({
      where: { id: taskId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete task:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
