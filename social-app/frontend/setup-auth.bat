@echo off
echo 🔐 Setting up Authentication System...

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
if not exist .env.local (
    copy env.example .env.local
    echo ✅ Created .env.local file from template
    echo ⚠️  Please update .env.local with your actual values:
    echo    - NEXTAUTH_SECRET: Generate a random secret key
    echo    - DATABASE_URL: Update if using a different database
) else (
    echo ⚠️  .env.local file already exists, skipping...
)

echo 🔧 Generating Prisma client...
npx prisma generate

echo 📊 Setting up database...
npx prisma db push

echo 🌱 Seeding database with sample data...
npx prisma db seed

echo ✅ Authentication setup completed successfully!
echo.
echo 📋 Next steps:
echo   1. Update .env.local with your configuration
echo   2. Run 'npm run dev' to start the development server
echo   3. Visit http://localhost:3001 to test the authentication
echo   4. Create a new account or use existing credentials
echo.
echo 🔑 Sample credentials (if seeded):
echo    Email: admin@socialapp.com
echo    Password: hashed_password_123
echo    Organization: org_123
echo.
echo 🎉 Happy coding!
pause



