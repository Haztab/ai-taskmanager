-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "dbMode" TEXT NOT NULL DEFAULT 'mock',
    "anthropicApiKey" TEXT,
    "claudeCodeModel" TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
    "dailyTokenLimit" INTEGER NOT NULL DEFAULT 5000000
);
INSERT INTO "new_AppSettings" ("dbMode", "id") SELECT "dbMode", "id" FROM "AppSettings";
DROP TABLE "AppSettings";
ALTER TABLE "new_AppSettings" RENAME TO "AppSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
