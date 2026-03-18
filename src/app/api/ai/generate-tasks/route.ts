import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateWithClaude } from "@/lib/ai/claude-client";
import { GENERATE_TASKS_PROMPT } from "@/lib/ai/prompts";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description, projectId } = body;

    if (!description || !projectId) {
      return NextResponse.json(
        { error: "description and projectId are required" },
        { status: 400 }
      );
    }

    const workstreams = await prisma.workstream.findMany({
      where: { projectId },
    });

    const workstreamSlugs = workstreams.map((ws) => ws.slug).join(", ");

    const prompt = GENERATE_TASKS_PROMPT.replace(
      "{description}",
      description
    ).replace("{workstreams}", workstreamSlugs);

    const { text } = await generateWithClaude(prompt, projectId);
    const tasks = JSON.parse(text);

    const createdTasks = await Promise.all(
      tasks.map(
        async (
          task: {
            title: string;
            description: string;
            userStory: string;
            acceptanceCriteria: string[];
            estimatedEffort: string;
            workstream: string;
            priority: number;
          },
          index: number
        ) => {
          const workstream = workstreams.find(
            (ws) => ws.slug === task.workstream
          );

          return prisma.task.create({
            data: {
              title: task.title,
              description: task.description,
              userStory: task.userStory,
              acceptanceCriteria: JSON.stringify(task.acceptanceCriteria),
              estimatedEffort: task.estimatedEffort,
              priority: task.priority || 3,
              sortOrder: index,
              projectId,
              workstreamId: workstream?.id,
            },
            include: {
              epic: true,
              workstream: true,
            },
          });
        }
      )
    );

    return NextResponse.json(createdTasks, { status: 201 });
  } catch (error) {
    console.error("Failed to generate tasks:", error);
    return NextResponse.json(
      { error: "Failed to generate tasks" },
      { status: 500 }
    );
  }
}
