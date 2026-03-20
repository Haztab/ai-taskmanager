import { prisma } from "@/lib/db";
import { execFile } from "child_process";

/**
 * Strip markdown code fences from Claude's output.
 * The CLI often wraps JSON in ```json ... ``` blocks.
 */
function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  // Match ```json ... ``` or ``` ... ```
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (match) return match[1].trim();
  return trimmed;
}

export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

async function getSettings() {
  try {
    return await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  } catch {
    return null;
  }
}

async function getClaudeBinary(): Promise<string> {
  const settings = await getSettings();
  return settings?.claudeCodePath || "claude";
}

async function getModel(): Promise<string> {
  const settings = await getSettings();
  return settings?.claudeCodeModel || "claude-sonnet-4-20250514";
}

async function trackUsage(usage: UsageInfo, projectId?: string, sessionId?: string) {
  try {
    await prisma.tokenUsage.create({
      data: {
        source: "api",
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        model: usage.model,
        sessionId,
        projectId,
      },
    });
  } catch (e) {
    console.error("Failed to track usage:", e);
  }
}

/**
 * Check if we should use API key directly or Claude CLI.
 * Returns the API key if one is configured, null otherwise.
 */
async function getApiKey(): Promise<string | null> {
  const settings = await getSettings();
  if (settings?.anthropicApiKey) return settings.anthropicApiKey;
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  return null;
}

/**
 * Non-streaming generation using Claude CLI (--print --output-format json)
 * or Anthropic SDK if an API key is available.
 */
export async function generateWithClaude(
  prompt: string,
  projectId?: string
): Promise<{ text: string; usage: UsageInfo }> {
  const apiKey = await getApiKey();

  if (apiKey) {
    // Use SDK directly
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const model = await getModel();
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const usage: UsageInfo = {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      model,
    };
    await trackUsage(usage, projectId);

    const block = message.content[0];
    if (block.type === "text") return { text: block.text, usage };
    throw new Error("Unexpected response type");
  }

  // Use Claude CLI
  const binary = await getClaudeBinary();
  const model = await getModel();

  return new Promise((resolve, reject) => {
    const child = execFile(
      binary,
      ["-p", "--output-format", "json", "--model", model],
      { timeout: 120000, maxBuffer: 10 * 1024 * 1024, env: { ...process.env }, shell: true },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Claude CLI error: ${stderr || error.message}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          const usage: UsageInfo = {
            inputTokens: result.usage?.input_tokens || result.usage?.inputTokens || 0,
            outputTokens: result.usage?.output_tokens || result.usage?.outputTokens || 0,
            model: Object.keys(result.modelUsage || {})[0] || model,
          };

          // Sum up tokens from modelUsage if available
          if (result.modelUsage) {
            let totalIn = 0, totalOut = 0;
            for (const m of Object.values(result.modelUsage) as Record<string, number>[]) {
              totalIn += (m.inputTokens || 0) + (m.cacheReadInputTokens || 0) + (m.cacheCreationInputTokens || 0);
              totalOut += m.outputTokens || 0;
            }
            if (totalIn > 0) usage.inputTokens = totalIn;
            if (totalOut > 0) usage.outputTokens = totalOut;
          }

          trackUsage(usage, projectId);
          resolve({ text: stripCodeFences(result.result || ""), usage });
        } catch {
          reject(new Error(`Failed to parse Claude CLI output: ${stdout.slice(0, 200)}`));
        }
      }
    );

    child.stdin?.write(prompt);
    child.stdin?.end();
  });
}

/**
 * Streaming generation using Claude CLI (--print --output-format stream-json)
 * or Anthropic SDK if an API key is available.
 */
export async function* streamWithClaude(
  prompt: string,
  projectId?: string
): AsyncGenerator<string, UsageInfo> {
  const apiKey = await getApiKey();

  if (apiKey) {
    // Use SDK streaming directly
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const model = await getModel();
    const client = new Anthropic({ apiKey });
    const stream = client.messages.stream({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    let inputTokens = 0;
    let outputTokens = 0;

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
      if (event.type === "message_delta") {
        outputTokens = event.usage.output_tokens;
      }
      if (event.type === "message_start") {
        inputTokens = event.message.usage.input_tokens;
      }
    }

    const usage: UsageInfo = { inputTokens, outputTokens, model };
    await trackUsage(usage, projectId);
    return usage;
  }

  // Use Claude CLI with stream-json output (requires --verbose)
  const binary = await getClaudeBinary();
  const model = await getModel();

  const { spawn } = await import("child_process");
  const child = spawn(binary, ["-p", "--verbose", "--output-format", "stream-json", "--model", model], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  child.stdin.write(prompt);
  child.stdin.end();

  let inputTokens = 0;
  let outputTokens = 0;
  let usedModel = model;
  let buffer = "";
  // Track text we've already yielded to avoid duplicates from the "result" event
  let yieldedLength = 0;

  const stdout = child.stdout;

  try {
    for await (const chunk of stdout) {
      buffer += chunk.toString();

      // Process complete lines (each line is a JSON object)
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const event = JSON.parse(trimmed);

          // CLI stream-json emits {"type":"assistant","message":{"content":[{"type":"text","text":"..."}]}}
          // for incremental text content
          if (event.type === "assistant" && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === "text" && block.text) {
                // The CLI sends the full accumulated text each time, so yield only new chars
                const fullText = block.text;
                if (fullText.length > yieldedLength) {
                  yield fullText.slice(yieldedLength);
                  yieldedLength = fullText.length;
                }
              }
            }
          }

          // Final result event with complete text and usage
          if (event.type === "result") {
            // Yield any remaining text from the result
            if (event.result && event.result.length > yieldedLength) {
              yield event.result.slice(yieldedLength);
              yieldedLength = event.result.length;
            }

            if (event.modelUsage) {
              for (const [m, u] of Object.entries(event.modelUsage) as [string, Record<string, number>][]) {
                usedModel = m;
                inputTokens += (u.inputTokens || 0) + (u.cacheReadInputTokens || 0) + (u.cacheCreationInputTokens || 0);
                outputTokens += u.outputTokens || 0;
              }
            }
          }
        } catch {
          // Malformed line, skip
        }
      }
    }
  } finally {
    child.kill();
  }

  const usage: UsageInfo = { inputTokens, outputTokens, model: usedModel };
  await trackUsage(usage, projectId);
  return usage;
}
