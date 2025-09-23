#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const dbPath = join(__dirname, 'dev.db');

console.log('🚀 Starting database migration...');

try {
  // Check if database file exists
  if (existsSync(dbPath)) {
    console.log('📁 Database file exists, backing up...');
    const backupPath = `${dbPath}.backup.${Date.now()}`;
    execSync(`cp "${dbPath}" "${backupPath}"`, { stdio: 'inherit' });
    console.log(`✅ Database backed up to: ${backupPath}`);
  }

  // Generate Prisma client
  console.log('🔧 Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });

  // Push schema to database
  console.log('📊 Pushing schema to database...');
  execSync('npx prisma db push', { stdio: 'inherit' });

  // Run seed script
  console.log('🌱 Seeding database...');
  execSync('npx tsx seed.ts', { stdio: 'inherit' });

  console.log('✅ Migration completed successfully!');
  console.log('📊 You can now use Prisma Studio to view your data:');
  console.log('   npx prisma studio');

} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}



