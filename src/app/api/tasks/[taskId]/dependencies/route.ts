import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST — add a dependency (this task depends on dependencyId)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const body = await request.json();
    const { dependencyId } = body;

    if (!dependencyId) {
      return NextResponse.json(
        { error: "dependencyId is required" },
        { status: 400 }
      );
    }

    if (dependencyId === taskId) {
      return NextResponse.json(
        { error: "A task cannot depend on itself" },
        { status: 400 }
      );
    }

    // Check for circular dependency: if dependencyId already depends on taskId
    const reverse = await prisma.taskDependency.findFirst({
      where: { dependentId: dependencyId, dependencyId: taskId },
    });
    if (reverse) {
      return NextResponse.json(
        { error: "Circular dependency: that task already depends on this one" },
        { status: 400 }
      );
    }

    // Check if already exists
    const existing = await prisma.taskDependency.findUnique({
      where: {
        dependentId_dependencyId: {
          dependentId: taskId,
          dependencyId,
        },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Dependency already exists" },
        { status: 409 }
      );
    }

    const dep = await prisma.taskDependency.create({
      data: { dependentId: taskId, dependencyId },
      include: {
        dependency: { select: { id: true, title: true, status: true } },
      },
    });

    return NextResponse.json(dep, { status: 201 });
  } catch (error) {
    console.error("Failed to add dependency:", error);
    return NextResponse.json(
      { error: "Failed to add dependency" },
      { status: 500 }
    );
  }
}

// DELETE — remove a dependency
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const body = await request.json();
    const { dependencyId } = body;

    if (!dependencyId) {
      return NextResponse.json(
        { error: "dependencyId is required" },
        { status: 400 }
      );
    }

    await prisma.taskDependency.deleteMany({
      where: { dependentId: taskId, dependencyId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove dependency:", error);
    return NextResponse.json(
      { error: "Failed to remove dependency" },
      { status: 500 }
    );
  }
}
