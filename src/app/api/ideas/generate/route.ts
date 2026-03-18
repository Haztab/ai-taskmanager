import { NextRequest } from "next/server";
import { streamWithClaude } from "@/lib/ai/claude-client";
import { IDEA_GENERATION_PROMPT } from "@/lib/ai/prompts";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectDescription, projectId } = body;

    if (!projectDescription) {
      return new Response(
        JSON.stringify({ error: "projectDescription is required" }),
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
        try {
          for await (const chunk of streamWithClaude(prompt, projectId)) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
            );
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
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
