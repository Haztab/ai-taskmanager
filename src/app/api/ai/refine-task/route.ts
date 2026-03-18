import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateWithClaude } from "@/lib/ai/claude-client";
import { REFINE_TASK_PROMPT } from "@/lib/ai/prompts";

export async function POST(request: NextRequest) {
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
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const prompt = REFINE_TASK_PROMPT.replace("{title}", task.title)
      .replace("{description}", task.description || "None")
      .replace("{userStory}", task.userStory || "None")
      .replace("{acceptanceCriteria}", task.acceptanceCriteria || "None");

    const { text } = await generateWithClaude(prompt, task.projectId);
    const refinement = JSON.parse(text);

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        description: refinement.description,
        userStory: refinement.userStory,
        acceptanceCriteria: JSON.stringify(refinement.acceptanceCriteria),
      },
      include: {
        epic: true,
        workstream: true,
      },
    });

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error("Failed to refine task:", error);
    return NextResponse.json(
      { error: "Failed to refine task" },
      { status: 500 }
    );
  }
}
