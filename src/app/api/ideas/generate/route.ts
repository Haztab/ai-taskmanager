import { NextRequest } from "next/server";
import { streamWithClaude } from "@/lib/ai/claude-client";
import { IDEA_GENERATION_PROMPT } from "@/lib/ai/prompts";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectDescription, projectId } = body;

    if (!projectDescription || !projectId) {
      return new Response(
        JSON.stringify({ error: "projectDescription and projectId are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const prompt = IDEA_GENERATION_PROMPT.replace(
      "{projectDescription}",
      projectDescription
    );

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let accumulated = "";
        try {
          for await (const chunk of streamWithClaude(prompt, projectId)) {
            accumulated += chunk;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
            );
          }

          // Parse and save ideas to DB
          const ideas = parseIdeasFromText(accumulated);
          if (ideas.length > 0) {
            await prisma.idea.createMany({
              data: ideas.map((idea) => ({
                title: idea.title,
                description: idea.description,
                category: idea.category,
                projectId,
              })),
            });
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, count: ideas.length })}\n\n`
            )
          );
          controller.close();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: message })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Failed to generate ideas:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate ideas" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

interface ParsedIdea {
  title: string;
  description: string;
  category: string;
}

function parseIdeasFromText(text: string): ParsedIdea[] {
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item: unknown): item is ParsedIdea =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as ParsedIdea).title === "string" &&
            typeof (item as ParsedIdea).description === "string" &&
            typeof (item as ParsedIdea).category === "string"
        );
      }
    } catch {
      // fall through
    }
  }
  return [];
}
