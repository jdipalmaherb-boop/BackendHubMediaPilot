-- Add missing updatedAt column used by Prisma
ALTER TABLE "SocialAccount"
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
