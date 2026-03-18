import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { planThenExecute } from "@/lib/claude-code/executor";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const body = await request.json();
    const { prompt } = body;

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "prompt is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return new Response(
        JSON.stringify({ error: "Task not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!task.worktreePath) {
      return new Response(
        JSON.stringify({
          error: "Task must have a worktree path set before execution",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const session = await prisma.claudeSession.create({
      data: {
        taskId,
        prompt,
        status: "planning",
      },
    });

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        const send = (data: Record<string, unknown>) => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
            );
          } catch {
            // Stream may be closed
          }
        };

        send({ type: "session", sessionId: session.id });
        send({ type: "phase", phase: "planning" });

        let planText = "";
        let outputText = "";

        planThenExecute(session.id, {
          prompt,
          cwd: task.worktreePath!,
          taskContext: {
            title: task.title,
            description: task.description,
            acceptanceCriteria: task.acceptanceCriteria,
          },
          onPlanData: (data: string) => {
            planText += data;
            send({ type: "plan", data });
          },
          onExecuteData: (data: string) => {
            outputText += data;
            send({ type: "output", data });
          },
          onError: (data: string) => {
            send({ type: "error", data });
          },
          onPlanComplete: async (plan: string) => {
            await prisma.claudeSession.update({
              where: { id: session.id },
              data: { plan, status: "running" },
            });
            send({ type: "phase", phase: "executing" });
          },
          onClose: async (code: number | null) => {
            const status = code === 0 ? "completed" : "failed";

            // Parse token usage from Claude Code output if available
            const tokenInfo = parseTokenUsage(planText + outputText);

            await prisma.claudeSession.update({
              where: { id: session.id },
              data: {
                output: outputText,
                status,
                inputTokens: tokenInfo.inputTokens,
                outputTokens: tokenInfo.outputTokens,
              },
            });

            // Track usage
            if (tokenInfo.inputTokens > 0 || tokenInfo.outputTokens > 0) {
              await prisma.tokenUsage.create({
                data: {
                  source: "claude-code",
                  inputTokens: tokenInfo.inputTokens,
                  outputTokens: tokenInfo.outputTokens,
                  model: "claude-code",
                  sessionId: session.id,
                  projectId: task.projectId,
                },
              });
            }

            send({
              type: "done",
              code,
              status,
              usage: {
                inputTokens: tokenInfo.inputTokens,
                outputTokens: tokenInfo.outputTokens,
              },
            });

            try {
              controller.close();
            } catch {
              // Stream may be closed
            }
          },
        });
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
    console.error("Failed to execute task:", error);
    return new Response(
      JSON.stringify({ error: "Failed to execute task" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

function parseTokenUsage(output: string): {
  inputTokens: number;
  outputTokens: number;
} {
  let inputTokens = 0;
  let outputTokens = 0;

  // Claude Code outputs usage info in various formats
  // Try to parse "X input tokens" and "Y output tokens" patterns
  const inputMatch = output.match(
    /(\d[\d,]*)\s*input\s*tokens/i
  );
  const outputMatch = output.match(
    /(\d[\d,]*)\s*output\s*tokens/i
  );

  if (inputMatch) {
    inputTokens = parseInt(inputMatch[1].replace(/,/g, ""), 10);
  }
  if (outputMatch) {
    outputTokens = parseInt(outputMatch[1].replace(/,/g, ""), 10);
  }

  // Also try "Total tokens: X" or "tokens used: X"
  const totalMatch = output.match(
    /total\s*(?:tokens|cost)[:\s]*(\d[\d,]*)/i
  );
  if (totalMatch && inputTokens === 0 && outputTokens === 0) {
    const total = parseInt(totalMatch[1].replace(/,/g, ""), 10);
    // Estimate split if only total is available
    inputTokens = Math.round(total * 0.3);
    outputTokens = Math.round(total * 0.7);
  }

  return { inputTokens, outputTokens };
}
