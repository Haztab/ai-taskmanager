import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { existsSync } from "fs";

// POST — git operations on a worktree
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, worktreePath, repoPath, branchName, commitMessage } = body;

    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 });
    }

    // --- STATUS: get git status of worktree ---
    if (action === "status") {
      if (!worktreePath || !existsSync(worktreePath)) {
        return NextResponse.json({ error: "Invalid worktree path" }, { status: 400 });
      }

      const status = execSync("git status --porcelain -u", {
        cwd: worktreePath, encoding: "utf-8", timeout: 5000,
      }).trim();

      const branch = execSync("git branch --show-current", {
        cwd: worktreePath, encoding: "utf-8", timeout: 3000,
      }).trim();

      let diffStat = "";
      try {
        diffStat = execSync("git diff --stat HEAD", {
          cwd: worktreePath, encoding: "utf-8", timeout: 5000,
        }).trim();
      } catch { /* no HEAD or no changes */ }

      return NextResponse.json({
        status,
        branch,
        diffStat,
        hasChanges: status.length > 0,
      });
    }

    // --- COMMIT: stage all and commit ---
    if (action === "commit") {
      if (!worktreePath || !existsSync(worktreePath)) {
        return NextResponse.json({ error: "Invalid worktree path" }, { status: 400 });
      }
      if (!commitMessage) {
        return NextResponse.json({ error: "commitMessage is required" }, { status: 400 });
      }

      // Stage all changes
      execSync("git add -A", {
        cwd: worktreePath, encoding: "utf-8", timeout: 10000,
      });

      // Commit
      execSync(`git commit -m ${JSON.stringify(commitMessage)}`, {
        cwd: worktreePath, encoding: "utf-8", timeout: 10000,
      });

      const commitHash = execSync("git rev-parse --short HEAD", {
        cwd: worktreePath, encoding: "utf-8", timeout: 3000,
      }).trim();

      const branch = execSync("git branch --show-current", {
        cwd: worktreePath, encoding: "utf-8", timeout: 3000,
      }).trim();

      return NextResponse.json({
        success: true,
        commitHash,
        branch,
        message: commitMessage,
      });
    }

    // --- MERGE: merge task branch into main ---
    if (action === "merge") {
      if (!repoPath || !existsSync(repoPath)) {
        return NextResponse.json({ error: "Invalid repoPath" }, { status: 400 });
      }
      if (!branchName) {
        return NextResponse.json({ error: "branchName is required" }, { status: 400 });
      }

      // Switch to main in the main repo
      const currentBranch = execSync("git branch --show-current", {
        cwd: repoPath, encoding: "utf-8", timeout: 3000,
      }).trim();

      if (currentBranch !== "main") {
        execSync("git checkout main", {
          cwd: repoPath, encoding: "utf-8", timeout: 10000,
        });
      }

      // Merge the task branch
      const mergeOutput = execSync(`git merge ${JSON.stringify(branchName)} --no-ff -m ${JSON.stringify(`Merge ${branchName} into main`)}`, {
        cwd: repoPath, encoding: "utf-8", timeout: 30000,
      }).trim();

      return NextResponse.json({
        success: true,
        mergeOutput,
        branch: branchName,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Git operation failed";
    console.error("Git operation failed:", message);

    // Extract git error message from stderr
    let gitError = message;
    if (message.includes("stderr")) {
      const match = message.match(/stderr:\s*'([^']+)'/);
      if (match) gitError = match[1].trim();
    }

    return NextResponse.json({ error: gitError }, { status: 500 });
  }
}
