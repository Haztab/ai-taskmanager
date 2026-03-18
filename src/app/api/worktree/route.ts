import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createWorktree, removeWorktree } from "@/lib/git/worktree";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, repoPath } = body;

    if (!taskId || !repoPath) {
      return NextResponse.json(
        { error: "taskId and repoPath are required" },
        { status: 400 }
      );
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const slug = task.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30);

    const { worktreePath, branchName } = createWorktree(
      repoPath,
      taskId,
      slug
    );

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { worktreePath, branchName },
    });

    return NextResponse.json(
      { worktreePath, branchName, task: updatedTask },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create worktree:", error);
    return NextResponse.json(
      { error: "Failed to create worktree" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId } = body;

    if (!taskId) {
      return NextResponse.json(
        { error: "taskId is required" },
        { status: 400 }
      );
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (!task.worktreePath || !task.project.repoPath) {
      return NextResponse.json(
        { error: "Task has no worktree or project has no repo path" },
        { status: 400 }
      );
    }

    removeWorktree(task.project.repoPath, task.worktreePath);

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { worktreePath: null, branchName: null },
    });

    return NextResponse.json({ success: true, task: updatedTask });
  } catch (error) {
    console.error("Failed to remove worktree:", error);
    return NextResponse.json(
      { error: "Failed to remove worktree" },
      { status: 500 }
    );
  }
}
