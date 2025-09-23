@echo off
echo 🚀 Setting up Social App Database...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

echo 📦 Installing dependencies...
npm install

echo 📋 Setting up environment...
if not exist .env (
    copy env.example .env
    echo ✅ Created .env file from template
) else (
    echo ⚠️  .env file already exists, skipping...
)

echo 🔧 Generating Prisma client...
npx prisma generate

echo 📊 Setting up database...
npx prisma db push

echo 🌱 Seeding database with sample data...
npx tsx seed.ts

echo ✅ Database setup completed successfully!
echo.
echo 📋 Next steps:
echo   1. Run 'npm run studio' to view your data
echo   2. Import the database service in your code:
echo      import { db } from './database';
echo   3. Check the README.md for usage examples
echo.
echo 🎉 Happy coding!
pause



