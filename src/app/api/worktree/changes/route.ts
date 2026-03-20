import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { existsSync } from "fs";

interface FileChange {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "untracked";
  additions?: number;
  deletions?: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const worktreePath = searchParams.get("path");

    if (!worktreePath) {
      return NextResponse.json(
        { error: "path query parameter is required" },
        { status: 400 }
      );
    }

    if (!existsSync(worktreePath)) {
      return NextResponse.json(
        { error: "Worktree path does not exist" },
        { status: 404 }
      );
    }

    const files: FileChange[] = [];

    // Get staged + unstaged changes
    try {
      const statusOutput = execSync(
        "git status --porcelain -u",
        { cwd: worktreePath, encoding: "utf-8", timeout: 5000 }
      ).trim();

      if (statusOutput) {
        for (const line of statusOutput.split("\n")) {
          if (!line.trim()) continue;
          const code = line.slice(0, 2);
          const filePath = line.slice(3).trim();

          let status: FileChange["status"] = "modified";
          if (code.includes("A") || code.includes("?")) status = "added";
          else if (code.includes("D")) status = "deleted";
          else if (code.includes("R")) status = "renamed";
          else if (code === "??") status = "untracked";

          files.push({ path: filePath, status });
        }
      }
    } catch {
      // Not a git repo or other error
    }

    // Get diff stats for changed files
    try {
      const diffOutput = execSync(
        "git diff --numstat HEAD 2>/dev/null || git diff --numstat",
        { cwd: worktreePath, encoding: "utf-8", timeout: 5000 }
      ).trim();

      if (diffOutput) {
        for (const line of diffOutput.split("\n")) {
          const parts = line.split("\t");
          if (parts.length >= 3) {
            const additions = parts[0] === "-" ? 0 : parseInt(parts[0], 10);
            const deletions = parts[1] === "-" ? 0 : parseInt(parts[1], 10);
            const filePath = parts[2];

            const existing = files.find((f) => f.path === filePath);
            if (existing) {
              existing.additions = additions;
              existing.deletions = deletions;
            }
          }
        }
      }
    } catch {
      // No HEAD yet or other error
    }

    // Get the diff content for viewing
    let diff = "";
    try {
      diff = execSync(
        "git diff HEAD 2>/dev/null || git diff",
        { cwd: worktreePath, encoding: "utf-8", timeout: 10000, maxBuffer: 5 * 1024 * 1024 }
      );
    } catch {
      // ignore
    }

    // Get branch name
    let branch = "";
    try {
      branch = execSync(
        "git branch --show-current",
        { cwd: worktreePath, encoding: "utf-8", timeout: 3000 }
      ).trim();
    } catch {
      // ignore
    }

    return NextResponse.json({
      files,
      diff,
      branch,
      totalAdditions: files.reduce((sum, f) => sum + (f.additions ?? 0), 0),
      totalDeletions: files.reduce((sum, f) => sum + (f.deletions ?? 0), 0),
    });
  } catch (error) {
    console.error("Failed to get worktree changes:", error);
    return NextResponse.json(
      { error: "Failed to get worktree changes" },
      { status: 500 }
    );
  }
}
