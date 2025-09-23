#!/bin/bash

echo "🚀 Starting deployment of Social App..."

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

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v vercel &> /dev/null; then
        print_error "Vercel CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! command -v railway &> /dev/null; then
        print_error "Railway CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        print_warning "Docker is not installed. Docker deployment will be skipped."
    fi
    
    print_status "All dependencies are available."
}

# Deploy frontend to Vercel
deploy_frontend() {
    print_status "Deploying frontend to Vercel..."
    
    cd social-app/frontend
    
    # Install dependencies
    npm install
    
    # Build the project
    npm run build
    
    # Deploy to Vercel
    vercel --prod
    
    cd ../..
    print_status "Frontend deployed successfully!"
}

# Deploy AI services to Railway
deploy_ai_services() {
    print_status "Deploying AI services to Railway..."
    
    cd social-app/ai-services
    
    # Install dependencies
    npm install
    
    # Build the project
    npm run build
    
    # Deploy to Railway
    railway up --detach
    
    cd ../..
    print_status "AI services deployed successfully!"
}

# Deploy social backend to Railway
deploy_social_backend() {
    print_status "Deploying social backend to Railway..."
    
    cd social-app/backend
    
    # Install dependencies
    npm install
    
    # Build the project
    npm run build
    
    # Deploy to Railway
    railway up --detach
    
    cd ../..
    print_status "Social backend deployed successfully!"
}

# Deploy Meta Ads integration to Railway
deploy_meta_ads() {
    print_status "Deploying Meta Ads integration to Railway..."
    
    cd integrations/meta-ads
    
    # Install dependencies
    npm install
    
    # Build the project
    npm run build
    
    # Deploy to Railway
    railway up --detach
    
    cd ../..
    print_status "Meta Ads integration deployed successfully!"
}

# Deploy GoHighLevel integration to Railway
deploy_gohighlevel() {
    print_status "Deploying GoHighLevel integration to Railway..."
    
    cd integrations/gohighlevel
    
    # Install dependencies
    npm install
    
    # Build the project
    npm run build
    
    # Deploy to Railway
    railway up --detach
    
    cd ../..
    print_status "GoHighLevel integration deployed successfully!"
}

# Run health checks
run_health_checks() {
    print_status "Running health checks..."
    
    # Wait a bit for services to start
    sleep 30
    
    # Health check endpoints (update with actual URLs after deployment)
    SERVICES=(
        "https://your-app.vercel.app/api/health"
        "https://your-ai-services.railway.app/health"
        "https://your-backend.railway.app/health"
        "https://your-meta-ads.railway.app/health"
        "https://your-gohighlevel.railway.app/health"
    )
    
    for service in "${SERVICES[@]}"; do
        echo "Checking $service..."
        if curl -f -s "$service" > /dev/null; then
            print_status "✅ $service is healthy"
        else
            print_warning "❌ $service is down (this is expected if URLs haven't been updated)"
        fi
    done
}

# Main deployment function
main() {
    print_status "Starting Social App deployment..."
    
    # Check dependencies
    check_dependencies
    
    # Deploy services
    deploy_frontend
    deploy_ai_services
    deploy_social_backend
    deploy_meta_ads
    deploy_gohighlevel
    
    # Run health checks
    run_health_checks
    
    print_status "🎉 Deployment completed!"
    print_status "Next steps:"
    print_status "1. Update environment variables in each service"
    print_status "2. Configure CORS settings with actual URLs"
    print_status "3. Set up monitoring and alerts"
    print_status "4. Test all functionality"
}

# Run main function
main



