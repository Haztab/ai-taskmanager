import { execSync, exec } from "child_process";
import { existsSync } from "fs";
import path from "path";

const WORKTREE_BASE = path.join(process.cwd(), "worktrees", "task");

export function getWorktreePath(taskId: string, slug: string): string {
  return path.join(WORKTREE_BASE, `${taskId}-${slug}`);
}

export function createWorktree(
  repoPath: string,
  taskId: string,
  slug: string,
  baseBranch: string = "main"
): { worktreePath: string; branchName: string } {
  const branchName = `task/${taskId}-${slug}`;
  const worktreePath = getWorktreePath(taskId, slug);

  if (existsSync(worktreePath)) {
    return { worktreePath, branchName };
  }

  execSync(`git worktree add -b "${branchName}" "${worktreePath}" "${baseBranch}"`, {
    cwd: repoPath,
    stdio: "pipe",
  });

  return { worktreePath, branchName };
}

export function removeWorktree(repoPath: string, worktreePath: string): void {
  if (existsSync(worktreePath)) {
    execSync(`git worktree remove "${worktreePath}" --force`, {
      cwd: repoPath,
      stdio: "pipe",
    });
  }
}

export function listWorktrees(repoPath: string): string[] {
  const output = execSync("git worktree list --porcelain", {
    cwd: repoPath,
    encoding: "utf-8",
  });
  return output
    .split("\n")
    .filter((line) => line.startsWith("worktree "))
    .map((line) => line.replace("worktree ", ""));
}
