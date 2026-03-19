import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";

let client: Anthropic | null = null;
let cachedKey: string | null = null;

async function getApiKey(): Promise<string> {
  // Check DB first (set via dashboard), fall back to env
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: "singleton" },
    });
    if (settings?.anthropicApiKey) return settings.anthropicApiKey;
  } catch {
    // DB not ready, fall back
  }
  return process.env.ANTHROPIC_API_KEY || "";
}

async function getModel(): Promise<string> {
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: "singleton" },
    });
    if (settings?.claudeCodeModel) return settings.claudeCodeModel;
  } catch {
    // fall back
  }
  return "claude-sonnet-4-20250514";
}

export async function getClaudeClient(): Promise<Anthropic> {
  const apiKey = await getApiKey();
  // Recreate client if key changed
  if (!client || cachedKey !== apiKey) {
    client = new Anthropic({ apiKey });
    cachedKey = apiKey;
  }
  return client;
}

export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  model: string;
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

export async function generateWithClaude(
  prompt: string,
  projectId?: string
): Promise<{ text: string; usage: UsageInfo }> {
  const claude = await getClaudeClient();
  const model = await getModel();
  const message = await claude.messages.create({
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
  if (block.type === "text") {
    return { text: block.text, usage };
  }
  throw new Error("Unexpected response type");
}

export async function* streamWithClaude(
  prompt: string,
  projectId?: string
): AsyncGenerator<string, UsageInfo> {
  const claude = await getClaudeClient();
  const model = await getModel();
  const stream = claude.messages.stream({
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
