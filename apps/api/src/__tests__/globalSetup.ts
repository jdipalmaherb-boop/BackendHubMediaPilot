import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { join } from 'path';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./test.db',
    },
  },
});

export default async function globalSetup() {
  console.log('🚀 Setting up test database...');
  
  try {
    // Generate Prisma client
    execSync('npx prisma generate', { stdio: 'inherit' });
    
    // Run migrations
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    
    // Seed test data
    execSync('npx prisma db seed', { stdio: 'inherit' });
    
    console.log('✅ Test database setup complete');
  } catch (error) {
    console.error('❌ Test database setup failed:', error);
    throw error;
  }
}
