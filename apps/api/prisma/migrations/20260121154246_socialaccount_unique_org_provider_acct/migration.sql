-- Ensure the columns exist (safe if they already do)
ALTER TABLE "SocialAccount"
  ADD COLUMN IF NOT EXISTS "orgId" TEXT,
  ADD COLUMN IF NOT EXISTS "provider" TEXT,
  ADD COLUMN IF NOT EXISTS "providerAccountId" TEXT;

-- Create the unique index Prisma needs for upsert ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS "SocialAccount_orgId_provider_providerAccountId_key"
  ON "SocialAccount" ("orgId", "provider", "providerAccountId");
