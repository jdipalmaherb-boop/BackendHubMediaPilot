#!/bin/bash
# BackendHub Preflight Validation Script
# Run this script to validate the complete BackendHub setup

set -e

echo "🚀 BackendHub Preflight Validation Script"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "PASS") echo -e "${GREEN}✅ $message${NC}" ;;
        "FAIL") echo -e "${RED}❌ $message${NC}" ;;
        "WARN") echo -e "${YELLOW}⚠️  $message${NC}" ;;
        "INFO") echo -e "${BLUE}ℹ️  $message${NC}" ;;
    esac
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is in use
port_in_use() {
    lsof -i :$1 >/dev/null 2>&1
}

echo ""
print_status "INFO" "Starting preflight validation..."

# Step 1: Check for secrets and .env files
echo ""
print_status "INFO" "Step 1: Checking for secrets and .env files"
if [ -f ".env" ]; then
    print_status "FAIL" ".env file found in repository - this should not be committed"
    exit 1
else
    print_status "PASS" "No .env files found in repository"
fi

# Check for hardcoded secrets
if grep -r "sk_live_" . --exclude-dir=node_modules --exclude-dir=.git --exclude="*.md" >/dev/null 2>&1; then
    print_status "WARN" "Potential live Stripe keys found - please verify these are placeholders"
else
    print_status "PASS" "No live Stripe keys found"
fi

if grep -r "AKIA" . --exclude-dir=node_modules --exclude-dir=.git --exclude="*.md" >/dev/null 2>&1; then
    print_status "WARN" "Potential AWS keys found - please verify these are placeholders"
else
    print_status "PASS" "No AWS keys found"
fi

# Step 2: Check Node.js and package managers
echo ""
print_status "INFO" "Step 2: Checking development tools"
if command_exists node; then
    NODE_VERSION=$(node --version)
    print_status "PASS" "Node.js installed: $NODE_VERSION"
    
    # Check if version is 18+
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -ge 18 ]; then
        print_status "PASS" "Node.js version is 18+ (compatible)"
    else
        print_status "FAIL" "Node.js version is too old (need 18+)"
        exit 1
    fi
else
    print_status "FAIL" "Node.js not installed"
    exit 1
fi

if command_exists pnpm; then
    PNPM_VERSION=$(pnpm --version)
    print_status "PASS" "pnpm installed: $PNPM_VERSION"
else
    print_status "WARN" "pnpm not installed - will use npm"
    if command_exists npm; then
        NPM_VERSION=$(npm --version)
        print_status "PASS" "npm installed: $NPM_VERSION"
    else
        print_status "FAIL" "Neither pnpm nor npm installed"
        exit 1
    fi
fi

# Step 3: Install dependencies
echo ""
print_status "INFO" "Step 3: Installing dependencies"
if command_exists pnpm; then
    print_status "INFO" "Installing dependencies with pnpm..."
    pnpm install
    print_status "PASS" "Dependencies installed successfully"
else
    print_status "INFO" "Installing dependencies with npm..."
    npm install
    print_status "PASS" "Dependencies installed successfully"
fi

# Step 4: Run linting
echo ""
print_status "INFO" "Step 4: Running linting"
if command_exists pnpm; then
    if pnpm run lint >/dev/null 2>&1; then
        print_status "PASS" "Linting passed"
    else
        print_status "WARN" "Linting issues found - run 'pnpm run lint:fix' to fix"
    fi
else
    if npm run lint >/dev/null 2>&1; then
        print_status "PASS" "Linting passed"
    else
        print_status "WARN" "Linting issues found - run 'npm run lint:fix' to fix"
    fi
fi

# Step 5: Run tests
echo ""
print_status "INFO" "Step 5: Running tests"
if command_exists pnpm; then
    if pnpm --filter api test >/dev/null 2>&1; then
        print_status "PASS" "API tests passed"
    else
        print_status "WARN" "Some tests failed - check test output"
    fi
else
    if npm run test:api >/dev/null 2>&1; then
        print_status "PASS" "API tests passed"
    else
        print_status "WARN" "Some tests failed - check test output"
    fi
fi

# Step 6: Check Docker
echo ""
print_status "INFO" "Step 6: Checking Docker"
if command_exists docker; then
    DOCKER_VERSION=$(docker --version)
    print_status "PASS" "Docker installed: $DOCKER_VERSION"
    
    if docker ps >/dev/null 2>&1; then
        print_status "PASS" "Docker daemon is running"
    else
        print_status "WARN" "Docker daemon not running - start Docker Desktop"
    fi
else
    print_status "WARN" "Docker not installed - required for infrastructure"
fi

# Step 7: Check ports
echo ""
print_status "INFO" "Step 7: Checking required ports"
PORTS=(3000 3001 5432 6379 9000 9001)
for port in "${PORTS[@]}"; do
    if port_in_use $port; then
        print_status "WARN" "Port $port is in use"
    else
        print_status "PASS" "Port $port is available"
    fi
done

# Step 8: Check environment files
echo ""
print_status "INFO" "Step 8: Checking environment configuration"
if [ -f "apps/api/env.example" ]; then
    print_status "PASS" "API environment template exists"
else
    print_status "FAIL" "API environment template missing"
fi

if [ -f "apps/web/env.example" ]; then
    print_status "PASS" "Web environment template exists"
else
    print_status "FAIL" "Web environment template missing"
fi

# Step 9: Check Prisma
echo ""
print_status "INFO" "Step 9: Checking Prisma configuration"
if [ -f "apps/api/prisma/schema.prisma" ]; then
    print_status "PASS" "Prisma schema exists"
else
    print_status "FAIL" "Prisma schema missing"
fi

# Step 10: Check Docker Compose
echo ""
print_status "INFO" "Step 10: Checking Docker Compose configuration"
if [ -f "docker-compose.yml" ]; then
    print_status "PASS" "Docker Compose file exists"
else
    print_status "FAIL" "Docker Compose file missing"
fi

# Summary
echo ""
print_status "INFO" "Preflight validation complete!"
echo ""
print_status "INFO" "Next steps:"
echo "1. Copy env.example files to .env and configure secrets"
echo "2. Start infrastructure: docker-compose up postgres redis minio -d"
echo "3. Run migrations: pnpm --filter api exec -- prisma migrate dev"
echo "4. Start API: pnpm --filter api dev"
echo "5. Start workers: pnpm --filter api run worker:video"
echo "6. Run smoke tests"
echo ""
print_status "INFO" "For detailed setup instructions, see README.md"
