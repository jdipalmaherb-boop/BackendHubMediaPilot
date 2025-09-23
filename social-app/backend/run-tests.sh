#!/bin/bash

echo "🧪 Running Social App Backend Tests..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[HEADER]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

print_header "Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    print_error "Failed to install dependencies"
    exit 1
fi

print_header "Running linting..."
npm run lint

if [ $? -ne 0 ]; then
    print_warning "Linting failed, but continuing with tests..."
fi

print_header "Running tests..."
npm test

if [ $? -eq 0 ]; then
    print_status "✅ All tests passed!"
    
    print_header "Running tests with coverage..."
    npm run test:coverage
    
    if [ $? -eq 0 ]; then
        print_status "✅ Coverage report generated!"
        print_status "📊 View coverage report: open coverage/lcov-report/index.html"
    else
        print_warning "Coverage report generation failed"
    fi
else
    print_error "❌ Tests failed!"
    exit 1
fi

print_status "🎉 Test run completed successfully!"



