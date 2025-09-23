@echo off
echo 🧪 Running Social App Backend Tests...

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
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo 🔍 Running linting...
npm run lint
if %errorlevel% neq 0 (
    echo ⚠️  Linting failed, but continuing with tests...
)

echo 🧪 Running tests...
npm test
if %errorlevel% neq 0 (
    echo ❌ Tests failed!
    pause
    exit /b 1
)

echo ✅ All tests passed!

echo 📊 Running tests with coverage...
npm run test:coverage
if %errorlevel% neq 0 (
    echo ⚠️  Coverage report generation failed
) else (
    echo ✅ Coverage report generated!
    echo 📊 View coverage report: open coverage/lcov-report/index.html
)

echo 🎉 Test run completed successfully!
pause



