import { NextRequest, NextResponse } from "next/server";
import { generateWithClaude } from "@/lib/ai/claude-client";
import { execSync } from "child_process";
import { existsSync } from "fs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { worktreePath, taskTitle, taskDescription } = body;

    if (!worktreePath || !existsSync(worktreePath)) {
      return NextResponse.json({ error: "Invalid worktree path" }, { status: 400 });
    }

    // Get git status and diff stat
    let gitStatus = "";
    let diffStat = "";
    try {
      gitStatus = execSync("git status --porcelain -u", {
        cwd: worktreePath, encoding: "utf-8", timeout: 5000,
      }).trim();
    } catch { /* ignore */ }

    try {
      diffStat = execSync("git diff --stat HEAD 2>/dev/null || git diff --stat", {
        cwd: worktreePath, encoding: "utf-8", timeout: 5000,
      }).trim();
    } catch { /* ignore */ }

    if (!gitStatus && !diffStat) {
      return NextResponse.json({ message: `feat: ${taskTitle?.toLowerCase() || "implement changes"}` });
    }

    const prompt = `Generate a concise git commit message using conventional commits format (feat/fix/refactor/docs/chore/style/test).

Rules:
- One line only, max 72 characters
- Format: type: short description
- Be specific about what changed
- No quotes, no explanation, just the commit message

Task: ${taskTitle || "Unknown task"}
${taskDescription ? `Context: ${taskDescription}` : ""}

Files changed:
${gitStatus}

Diff summary:
${diffStat}

Return ONLY the commit message.`;

    const { text } = await generateWithClaude(prompt);

    // Clean up: take first line, strip quotes/backticks
    const message = text
      .trim()
      .split("\n")[0]
      .replace(/^["'`]+|["'`]+$/g, "")
      .replace(/^```\w*\s*/, "")
      .replace(/\s*```$/, "")
      .trim();

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Failed to generate commit message:", error);
    // Fallback
    const taskTitle = (await request.clone().json().catch(() => ({}))).taskTitle;
    return NextResponse.json({
      message: `feat: ${taskTitle?.toLowerCase() || "implement changes"}`,
    });
  }
}
