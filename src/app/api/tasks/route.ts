import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const workstreamId = searchParams.get("workstreamId");
    const status = searchParams.get("status");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = { projectId };
    if (workstreamId) where.workstreamId = workstreamId;
    if (status) where.status = status;

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      include: {
        epic: true,
        workstream: true,
        // "dependents" relation = TaskDependency records where this task is the dependentId
        // i.e., "this task depends on dependency"
        dependents: {
          include: {
            dependency: {
              select: { id: true, title: true, status: true },
            },
          },
        },
      },
    });

    // Rename "dependents" to "dependencies" for the frontend
    // (Prisma's "dependents" relation = records where this task depends on others)
    const mapped = tasks.map((t) => {
      const { dependents, ...rest } = t as Record<string, unknown>;
      return { ...rest, dependencies: dependents };
    });

    return NextResponse.json(mapped);
  } catch (error) {
    console.error("Failed to fetch tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      userStory,
      acceptanceCriteria,
      status,
      priority,
      estimatedEffort,
      projectId,
      epicId,
      workstreamId,
    } = body;

    if (!title || !projectId) {
      return NextResponse.json(
        { error: "title and projectId are required" },
        { status: 400 }
      );
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        userStory,
        acceptanceCriteria: acceptanceCriteria
          ? JSON.stringify(acceptanceCriteria)
          : undefined,
        status: status || "backlog",
        priority: priority || 3,
        estimatedEffort,
        projectId,
        epicId,
        workstreamId,
      },
      include: {
        epic: true,
        workstream: true,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Failed to create task:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
