import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./test.db',
    },
  },
});

export default async function globalTeardown() {
  console.log('🧹 Cleaning up test database...');
  
  try {
    // Clean up test data
    await prisma.$executeRaw`DELETE FROM "RefreshToken"`;
    await prisma.$executeRaw`DELETE FROM "GptUsage"`;
    await prisma.$executeRaw`DELETE FROM "Job"`;
    await prisma.$executeRaw`DELETE FROM "ScheduledPost"`;
    await prisma.$executeRaw`DELETE FROM "PublishRecord"`;
    await prisma.$executeRaw`DELETE FROM "Campaign"`;
    await prisma.$executeRaw`DELETE FROM "Lead"`;
    await prisma.$executeRaw`DELETE FROM "GoHighLevelSync"`;
    await prisma.$executeRaw`DELETE FROM "Subscription"`;
    await prisma.$executeRaw`DELETE FROM "User"`;
    
    await prisma.$disconnect();
    console.log('✅ Test database cleanup complete');
  } catch (error) {
    console.error('❌ Test database cleanup failed:', error);
    throw error;
  }
}
