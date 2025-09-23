#!/bin/bash

echo "📋 Viewing logs for Social App services..."

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

# Function to view logs for a specific service
view_service_logs() {
    local service_name=$1
    local service_path=$2
    local lines=${3:-50}
    
    print_header "=== $service_name Logs (last $lines lines) ==="
    
    if [ -d "$service_path" ]; then
        cd "$service_path"
        
        # Check if it's a Railway service
        if [ -f "railway.json" ] || [ -f "railway.toml" ]; then
            print_status "Viewing Railway logs for $service_name..."
            railway logs --service "$service_name" --tail "$lines"
        else
            print_warning "No Railway configuration found for $service_name"
            print_status "Checking for local logs..."
            
            # Check for local log files
            if [ -f "logs/app.log" ]; then
                tail -n "$lines" logs/app.log
            elif [ -f "app.log" ]; then
                tail -n "$lines" app.log
            else
                print_warning "No log files found for $service_name"
            fi
        fi
        
        cd - > /dev/null
    else
        print_error "Service directory not found: $service_path"
    fi
    
    echo ""
}

# Function to view Vercel logs
view_vercel_logs() {
    print_header "=== Frontend (Vercel) Logs ==="
    
    if command -v vercel &> /dev/null; then
        print_status "Viewing Vercel logs..."
        vercel logs --follow
    else
        print_error "Vercel CLI not found. Please install it first."
    fi
    
    echo ""
}

# Main function
main() {
    print_status "Available services:"
    echo "1. Frontend (Vercel)"
    echo "2. AI Services (Railway)"
    echo "3. Social Backend (Railway)"
    echo "4. Meta Ads Integration (Railway)"
    echo "5. GoHighLevel Integration (Railway)"
    echo "6. All services"
    echo ""
    
    read -p "Select service to view logs (1-6): " choice
    
    case $choice in
        1)
            view_vercel_logs
            ;;
        2)
            view_service_logs "ai-services" "social-app/ai-services"
            ;;
        3)
            view_service_logs "social-backend" "social-app/backend"
            ;;
        4)
            view_service_logs "meta-ads" "integrations/meta-ads"
            ;;
        5)
            view_service_logs "gohighlevel" "integrations/gohighlevel"
            ;;
        6)
            print_status "Viewing logs for all services..."
            echo ""
            view_vercel_logs
            view_service_logs "ai-services" "social-app/ai-services" 20
            view_service_logs "social-backend" "social-app/backend" 20
            view_service_logs "meta-ads" "integrations/meta-ads" 20
            view_service_logs "gohighlevel" "integrations/gohighlevel" 20
            ;;
        *)
            print_error "Invalid choice. Please select 1-6."
            exit 1
            ;;
    esac
}

# Check if Railway CLI is available
if ! command -v railway &> /dev/null; then
    print_warning "Railway CLI not found. Railway logs will not be available."
fi

# Check if Vercel CLI is available
if ! command -v vercel &> /dev/null; then
    print_warning "Vercel CLI not found. Vercel logs will not be available."
fi

# Run main function
main



