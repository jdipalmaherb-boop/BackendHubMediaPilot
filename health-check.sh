#!/bin/bash

echo "🔍 Running health checks for Social App..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Health check function
check_service() {
    local service_name=$1
    local service_url=$2
    local timeout=${3:-10}
    
    echo -n "Checking $service_name... "
    
    if curl -f -s --max-time $timeout "$service_url" > /dev/null 2>&1; then
        print_status "✅ $service_name is healthy"
        return 0
    else
        print_error "❌ $service_name is down"
        return 1
    fi
}

# Get service URLs from environment or use defaults
FRONTEND_URL=${FRONTEND_URL:-"https://your-app.vercel.app/api/health"}
AI_SERVICES_URL=${AI_SERVICES_URL:-"https://your-ai-services.railway.app/health"}
SOCIAL_BACKEND_URL=${SOCIAL_BACKEND_URL:-"https://your-backend.railway.app/health"}
META_ADS_URL=${META_ADS_URL:-"https://your-meta-ads.railway.app/health"}
GOHIGHLEVEL_URL=${GOHIGHLEVEL_URL:-"https://your-gohighlevel.railway.app/health"}

# Services to check
SERVICES=(
    "Frontend|$FRONTEND_URL"
    "AI Services|$AI_SERVICES_URL"
    "Social Backend|$SOCIAL_BACKEND_URL"
    "Meta Ads Integration|$META_ADS_URL"
    "GoHighLevel Integration|$GOHIGHLEVEL_URL"
)

# Track results
HEALTHY_COUNT=0
TOTAL_COUNT=${#SERVICES[@]}

print_status "Checking $TOTAL_COUNT services..."

# Check each service
for service_info in "${SERVICES[@]}"; do
    IFS='|' read -r name url <<< "$service_info"
    if check_service "$name" "$url"; then
        ((HEALTHY_COUNT++))
    fi
    echo ""
done

# Summary
echo "=========================================="
if [ $HEALTHY_COUNT -eq $TOTAL_COUNT ]; then
    print_status "🎉 All services are healthy! ($HEALTHY_COUNT/$TOTAL_COUNT)"
    exit 0
else
    print_error "⚠️  Some services are down ($HEALTHY_COUNT/$TOTAL_COUNT healthy)"
    exit 1
fi



