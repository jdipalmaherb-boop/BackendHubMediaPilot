-- Add missing username column used by Prisma
ALTER TABLE "SocialAccount"
ADD COLUMN IF NOT EXISTS "username" TEXT;
