import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateWithClaude } from "@/lib/ai/claude-client";
import { PROMOTE_IDEA_PROMPT } from "@/lib/ai/prompts";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ideaId } = body;

    if (!ideaId) {
      return NextResponse.json(
        { error: "ideaId is required" },
        { status: 400 }
      );
    }

    const idea = await prisma.idea.findUnique({
      where: { id: ideaId },
      include: { project: { include: { workstreams: true } } },
    });

    if (!idea) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    }

    const workstreamSlugs = idea.project.workstreams
      .map((ws) => ws.slug)
      .join(", ");

    const prompt = PROMOTE_IDEA_PROMPT.replace("{ideaTitle}", idea.title)
      .replace("{ideaDescription}", idea.description)
      .replace("{workstreams}", workstreamSlugs);

    const { text } = await generateWithClaude(prompt, idea.projectId);
    const result = JSON.parse(text) as {
      epic: { title: string; description: string };
      tasks: {
        title: string;
        description: string;
        userStory: string;
        acceptanceCriteria: string[];
        estimatedEffort: string;
        workstream: string;
        priority?: number;
        dependsOn?: number[];
      }[];
    };

    const epic = await prisma.epic.create({
      data: {
        title: result.epic.title,
        description: result.epic.description,
        projectId: idea.projectId,
      },
    });

    // Create all tasks first
    const createdTasks = await Promise.all(
      result.tasks.map(async (task, index) => {
        const workstream = idea.project.workstreams.find(
          (ws) => ws.slug === task.workstream
        );

        return prisma.task.create({
          data: {
            title: task.title,
            description: task.description,
            userStory: task.userStory,
            acceptanceCriteria: JSON.stringify(task.acceptanceCriteria),
            estimatedEffort: task.estimatedEffort,
            priority: task.priority ?? 3,
            sortOrder: index,
            projectId: idea.projectId,
            epicId: epic.id,
            workstreamId: workstream?.id,
          },
        });
      })
    );

    // Create dependencies based on dependsOn indexes
    const dependencyRecords: { dependentId: string; dependencyId: string }[] = [];
    for (let i = 0; i < result.tasks.length; i++) {
      const deps = result.tasks[i].dependsOn ?? [];
      for (const depIndex of deps) {
        if (depIndex >= 0 && depIndex < createdTasks.length && depIndex !== i) {
          dependencyRecords.push({
            dependentId: createdTasks[i].id,
            dependencyId: createdTasks[depIndex].id,
          });
        }
      }
    }

    if (dependencyRecords.length > 0) {
      await prisma.taskDependency.createMany({
        data: dependencyRecords,
      });
    }

    await prisma.idea.update({
      where: { id: ideaId },
      data: { isPromoted: true, epicId: epic.id },
    });

    return NextResponse.json(
      { epic, tasks: createdTasks, dependencies: dependencyRecords.length },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to promote idea:", error);
    return NextResponse.json(
      { error: "Failed to promote idea" },
      { status: 500 }
    );
  }
}
