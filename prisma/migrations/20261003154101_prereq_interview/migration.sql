-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LearningPath" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topic" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'generating',
    "error" TEXT NOT NULL DEFAULT '',
    "providerUsed" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "interview" TEXT NOT NULL DEFAULT '{}',
    "prereqForId" TEXT,
    "lastRegeneratedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LearningPath_prereqForId_fkey" FOREIGN KEY ("prereqForId") REFERENCES "LearningPath" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_LearningPath" ("createdAt", "error", "id", "lastRegeneratedAt", "providerUsed", "status", "summary", "topic", "updatedAt", "version") SELECT "createdAt", "error", "id", "lastRegeneratedAt", "providerUsed", "status", "summary", "topic", "updatedAt", "version" FROM "LearningPath";
DROP TABLE "LearningPath";
ALTER TABLE "new_LearningPath" RENAME TO "LearningPath";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
