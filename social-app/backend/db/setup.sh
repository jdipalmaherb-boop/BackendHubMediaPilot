#!/bin/bash

echo "🚀 Setting up Social App Database..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo "📋 Setting up environment..."
if [ ! -f .env ]; then
    cp env.example .env
    echo "✅ Created .env file from template"
else
    echo "⚠️  .env file already exists, skipping..."
fi

echo "🔧 Generating Prisma client..."
npx prisma generate

echo "📊 Setting up database..."
npx prisma db push

echo "🌱 Seeding database with sample data..."
npx tsx seed.ts

echo "✅ Database setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "  1. Run 'npm run studio' to view your data"
echo "  2. Import the database service in your code:"
echo "     import { db } from './database';"
echo "  3. Check the README.md for usage examples"
echo ""
echo "🎉 Happy coding!"



