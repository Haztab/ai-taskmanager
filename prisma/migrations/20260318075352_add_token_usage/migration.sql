-- CreateTable
CREATE TABLE "TokenUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "model" TEXT,
    "sessionId" TEXT,
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ClaudeSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "plan" TEXT,
    "output" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClaudeSession_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ClaudeSession" ("createdAt", "id", "output", "prompt", "status", "taskId") SELECT "createdAt", "id", "output", "prompt", "status", "taskId" FROM "ClaudeSession";
DROP TABLE "ClaudeSession";
ALTER TABLE "new_ClaudeSession" RENAME TO "ClaudeSession";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
