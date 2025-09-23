// Export Prisma client
export { prisma, default as PrismaClient } from './prisma';

// Export database service
export { db, DatabaseService } from './database';

// Export types
export type {
  User,
  Post,
  Ad,
  LandingPage,
  Lead,
  Notification,
} from './generated/client';

// Re-export commonly used Prisma types
export type {
  Prisma,
  PrismaClient as PrismaClientType,
} from './generated/client';



