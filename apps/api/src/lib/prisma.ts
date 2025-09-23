import { PrismaClient } from '@prisma/client';

// Ensure a single PrismaClient instance across hot-reloads in development.
// DO NOT export new PrismaClient() directly from many modules.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;





