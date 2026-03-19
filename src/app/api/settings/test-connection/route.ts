import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, apiKey: providedKey } = body;

    if (type === "anthropic") {
      // Priority: provided key > DB key > env key
      const settings = await prisma.appSettings.findUnique({
        where: { id: "singleton" },
      });
      const apiKey = providedKey || settings?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;

      if (!apiKey) {
        return NextResponse.json({
          success: false,
          error: "No API key provided",
        });
      }

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: settings?.claudeCodeModel || "claude-sonnet-4-20250514",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({
          success: true,
          model: data.model,
          message: "API key is valid",
        });
      } else {
        const err = await res.json().catch(() => ({}));
        return NextResponse.json({
          success: false,
          error: err.error?.message || `HTTP ${res.status}`,
        });
      }
    }

    if (type === "claude-code") {
      try {
        const { execSync } = require("child_process");
        const version = execSync("claude --version 2>&1", {
          encoding: "utf-8",
          timeout: 10000,
        }).trim();

        return NextResponse.json({
          success: true,
          version,
          message: "Claude Code CLI found",
        });
      } catch (err: unknown) {
        return NextResponse.json({
          success: false,
          error:
            err instanceof Error
              ? err.message.includes("not found") || err.message.includes("ENOENT")
                ? "Claude Code CLI not installed. Install with: npm install -g @anthropic-ai/claude-code"
                : err.message
              : "Unknown error",
        });
      }
    }

    return NextResponse.json(
      { error: "Invalid type" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Connection test failed:", error);
    return NextResponse.json(
      { error: "Connection test failed" },
      { status: 500 }
    );
  }
}
