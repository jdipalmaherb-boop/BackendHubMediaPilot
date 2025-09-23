#!/bin/bash

echo "🔐 Setting up Authentication System..."

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
if [ ! -f .env.local ]; then
    cp env.example .env.local
    echo "✅ Created .env.local file from template"
    echo "⚠️  Please update .env.local with your actual values:"
    echo "   - NEXTAUTH_SECRET: Generate a random secret key"
    echo "   - DATABASE_URL: Update if using a different database"
else
    echo "⚠️  .env.local file already exists, skipping..."
fi

echo "🔧 Generating Prisma client..."
npx prisma generate

echo "📊 Setting up database..."
npx prisma db push

echo "🌱 Seeding database with sample data..."
npx prisma db seed

echo "✅ Authentication setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "  1. Update .env.local with your configuration"
echo "  2. Run 'npm run dev' to start the development server"
echo "  3. Visit http://localhost:3001 to test the authentication"
echo "  4. Create a new account or use existing credentials"
echo ""
echo "🔑 Sample credentials (if seeded):"
echo "   Email: admin@socialapp.com"
echo "   Password: hashed_password_123"
echo "   Organization: org_123"
echo ""
echo "🎉 Happy coding!"



