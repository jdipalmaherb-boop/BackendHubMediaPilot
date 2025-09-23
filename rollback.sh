#!/bin/bash

echo "🔄 Rollback script for Social App..."

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

# Function to rollback Vercel deployment
rollback_vercel() {
    print_header "Rolling back Vercel deployment..."
    
    if command -v vercel &> /dev/null; then
        print_status "Listing recent deployments..."
        vercel ls
        
        echo ""
        read -p "Enter deployment URL to rollback to: " deployment_url
        
        if [ -n "$deployment_url" ]; then
            print_status "Rolling back to $deployment_url..."
            vercel rollback "$deployment_url"
            print_status "Vercel rollback completed!"
        else
            print_warning "No deployment URL provided. Skipping Vercel rollback."
        fi
    else
        print_error "Vercel CLI not found. Please install it first."
    fi
    
    echo ""
}

# Function to rollback Railway deployment
rollback_railway() {
    local service_name=$1
    local service_path=$2
    
    print_header "Rolling back Railway deployment for $service_name..."
    
    if command -v railway &> /dev/null; then
        if [ -d "$service_path" ]; then
            cd "$service_path"
            
            print_status "Listing recent deployments for $service_name..."
            railway deployments
            
            echo ""
            read -p "Enter deployment ID to rollback to (or press Enter to skip): " deployment_id
            
            if [ -n "$deployment_id" ]; then
                print_status "Rolling back to deployment $deployment_id..."
                railway rollback "$deployment_id"
                print_status "Railway rollback completed for $service_name!"
            else
                print_warning "No deployment ID provided. Skipping rollback for $service_name."
            fi
            
            cd - > /dev/null
        else
            print_error "Service directory not found: $service_path"
        fi
    else
        print_error "Railway CLI not found. Please install it first."
    fi
    
    echo ""
}

# Main function
main() {
    print_status "Available rollback options:"
    echo "1. Frontend (Vercel)"
    echo "2. AI Services (Railway)"
    echo "3. Social Backend (Railway)"
    echo "4. Meta Ads Integration (Railway)"
    echo "5. GoHighLevel Integration (Railway)"
    echo "6. All services"
    echo ""
    
    read -p "Select service to rollback (1-6): " choice
    
    case $choice in
        1)
            rollback_vercel
            ;;
        2)
            rollback_railway "ai-services" "social-app/ai-services"
            ;;
        3)
            rollback_railway "social-backend" "social-app/backend"
            ;;
        4)
            rollback_railway "meta-ads" "integrations/meta-ads"
            ;;
        5)
            rollback_railway "gohighlevel" "integrations/gohighlevel"
            ;;
        6)
            print_status "Rolling back all services..."
            echo ""
            rollback_vercel
            rollback_railway "ai-services" "social-app/ai-services"
            rollback_railway "social-backend" "social-app/backend"
            rollback_railway "meta-ads" "integrations/meta-ads"
            rollback_railway "gohighlevel" "integrations/gohighlevel"
            ;;
        *)
            print_error "Invalid choice. Please select 1-6."
            exit 1
            ;;
    esac
    
    print_status "Rollback process completed!"
    print_status "Next steps:"
    print_status "1. Verify the rollback was successful"
    print_status "2. Check service health"
    print_status "3. Test functionality"
    print_status "4. Monitor for any issues"
}

# Check if required tools are available
if ! command -v vercel &> /dev/null && ! command -v railway &> /dev/null; then
    print_error "Neither Vercel CLI nor Railway CLI found. Please install at least one."
    exit 1
fi

# Run main function
main



