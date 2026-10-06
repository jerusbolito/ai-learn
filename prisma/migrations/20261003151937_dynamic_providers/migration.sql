-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL DEFAULT '',
    "apiKey" TEXT NOT NULL DEFAULT '',
    "models" TEXT NOT NULL DEFAULT '[]',
    "defaultModel" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Provider_slug_key" ON "Provider"("slug");

-- Carry over existing ApiCredential rows (provider names were
-- 'openai' | 'anthropic' | 'google', which are still valid kinds/slugs).
INSERT INTO "Provider"
    ("id", "slug", "label", "kind", "baseUrl", "apiKey", "models", "defaultModel", "createdAt", "updatedAt")
SELECT
    "id",
    "provider",
    CASE "provider"
        WHEN 'openai' THEN 'OpenAI'
        WHEN 'anthropic' THEN 'Anthropic'
        WHEN 'google' THEN 'Google Gemini'
        ELSE "provider"
    END,
    CASE WHEN "provider" IN ('openai', 'anthropic', 'google')
        THEN "provider" ELSE 'openai-compatible' END,
    '',
    "apiKey",
    CASE WHEN "preferredModel" != '' THEN json_array("preferredModel") ELSE '[]' END,
    "preferredModel",
    "createdAt",
    "updatedAt"
FROM "ApiCredential";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ApiCredential";
PRAGMA foreign_keys=on;
