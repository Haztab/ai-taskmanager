import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Support both single-task { taskId, status, sortOrder } and batch { tasks: [...] }
    const tasks: { id: string; status: string; sortOrder: number }[] = body.tasks
      ? body.tasks
      : body.taskId
        ? [{ id: body.taskId, status: body.status, sortOrder: body.sortOrder }]
        : [];

    if (tasks.length === 0) {
      return NextResponse.json(
        { error: "taskId or tasks array is required" },
        { status: 400 }
      );
    }

    await prisma.$transaction(
      tasks.map((task) =>
        prisma.task.update({
          where: { id: task.id },
          data: {
            status: task.status,
            sortOrder: task.sortOrder,
          },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to reorder tasks:", error);
    return NextResponse.json(
      { error: "Failed to reorder tasks" },
      { status: 500 }
    );
  }
}
