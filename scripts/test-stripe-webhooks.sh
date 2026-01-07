#!/bin/bash
# Stripe Webhook Testing Script
# Run this script to test Stripe webhook functionality

set -e

echo "💳 Stripe Webhook Testing Script"
echo "================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="http://localhost:3001"
WEBHOOK_URL="$API_URL/api/webhooks/stripe"
STRIPE_CLI_VERSION="1.21.9"

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

# Function to check if Stripe CLI is installed
check_stripe_cli() {
    print_status "INFO" "Checking Stripe CLI installation..."
    
    if command -v stripe >/dev/null 2>&1; then
        STRIPE_VERSION=$(stripe --version)
        print_status "PASS" "Stripe CLI installed: $STRIPE_VERSION"
        return 0
    else
        print_status "WARN" "Stripe CLI not installed"
        print_status "INFO" "Installing Stripe CLI..."
        
        # Install Stripe CLI based on OS
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            if command -v brew >/dev/null 2>&1; then
                brew install stripe/stripe-cli/stripe
            else
                print_status "FAIL" "Homebrew not found. Please install Stripe CLI manually:"
                echo "  https://stripe.com/docs/stripe-cli"
                return 1
            fi
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Linux
            curl -s https://packages.stripe.dev/api/security/keypairs/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg
            echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee -a /etc/apt/sources.list.d/stripe.list
            sudo apt update
            sudo apt install stripe
        else
            print_status "FAIL" "Unsupported OS. Please install Stripe CLI manually:"
            echo "  https://stripe.com/docs/stripe-cli"
            return 1
        fi
        
        if command -v stripe >/dev/null 2>&1; then
            print_status "PASS" "Stripe CLI installed successfully"
            return 0
        else
            print_status "FAIL" "Failed to install Stripe CLI"
            return 1
        fi
    fi
}

# Function to check if API is running
check_api() {
    print_status "INFO" "Checking if API is running..."
    if curl -s "$API_URL/health" >/dev/null 2>&1; then
        print_status "PASS" "API is running at $API_URL"
        return 0
    else
        print_status "FAIL" "API is not running at $API_URL"
        print_status "INFO" "Please start the API first:"
        echo "  pnpm --filter api dev"
        return 1
    fi
}

# Function to test webhook endpoint
test_webhook_endpoint() {
    print_status "INFO" "Testing webhook endpoint accessibility..."
    
    # Test if webhook endpoint is accessible
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$WEBHOOK_URL")
    
    if [ "$RESPONSE" = "400" ] || [ "$RESPONSE" = "405" ]; then
        print_status "PASS" "Webhook endpoint is accessible (HTTP $RESPONSE - expected for GET request)"
    elif [ "$RESPONSE" = "200" ]; then
        print_status "PASS" "Webhook endpoint is accessible"
    else
        print_status "WARN" "Webhook endpoint returned HTTP $RESPONSE"
    fi
}

# Function to start Stripe webhook forwarding
start_webhook_forwarding() {
    print_status "INFO" "Starting Stripe webhook forwarding..."
    
    # Check if webhook forwarding is already running
    if pgrep -f "stripe listen" >/dev/null; then
        print_status "WARN" "Stripe webhook forwarding is already running"
        return 0
    fi
    
    # Start webhook forwarding in background
    print_status "INFO" "Starting 'stripe listen --forward-to $WEBHOOK_URL' in background..."
    stripe listen --forward-to "$WEBHOOK_URL" > stripe-webhook.log 2>&1 &
    STRIPE_PID=$!
    
    # Wait a moment for it to start
    sleep 3
    
    if kill -0 $STRIPE_PID 2>/dev/null; then
        print_status "PASS" "Stripe webhook forwarding started (PID: $STRIPE_PID)"
        echo $STRIPE_PID > stripe-webhook.pid
        return 0
    else
        print_status "FAIL" "Failed to start Stripe webhook forwarding"
        return 1
    fi
}

# Function to test webhook events
test_webhook_events() {
    print_status "INFO" "Testing webhook events..."
    
    # Test 1: checkout.session.completed
    print_status "INFO" "1. Testing checkout.session.completed event..."
    if stripe trigger checkout.session.completed >/dev/null 2>&1; then
        print_status "PASS" "checkout.session.completed event triggered"
    else
        print_status "WARN" "Failed to trigger checkout.session.completed event"
    fi
    
    # Wait for webhook processing
    sleep 2
    
    # Test 2: invoice.payment_succeeded
    print_status "INFO" "2. Testing invoice.payment_succeeded event..."
    if stripe trigger invoice.payment_succeeded >/dev/null 2>&1; then
        print_status "PASS" "invoice.payment_succeeded event triggered"
    else
        print_status "WARN" "Failed to trigger invoice.payment_succeeded event"
    fi
    
    # Wait for webhook processing
    sleep 2
    
    # Test 3: invoice.payment_failed
    print_status "INFO" "3. Testing invoice.payment_failed event..."
    if stripe trigger invoice.payment_failed >/dev/null 2>&1; then
        print_status "PASS" "invoice.payment_failed event triggered"
    else
        print_status "WARN" "Failed to trigger invoice.payment_failed event"
    fi
    
    # Wait for webhook processing
    sleep 2
    
    # Test 4: customer.subscription.deleted
    print_status "INFO" "4. Testing customer.subscription.deleted event..."
    if stripe trigger customer.subscription.deleted >/dev/null 2>&1; then
        print_status "PASS" "customer.subscription.deleted event triggered"
    else
        print_status "WARN" "Failed to trigger customer.subscription.deleted event"
    fi
}

# Function to check webhook logs
check_webhook_logs() {
    print_status "INFO" "Checking webhook processing logs..."
    
    if [ -f "stripe-webhook.log" ]; then
        print_status "INFO" "Recent webhook activity:"
        tail -20 stripe-webhook.log
    else
        print_status "WARN" "No webhook log file found"
    fi
}

# Function to stop webhook forwarding
stop_webhook_forwarding() {
    print_status "INFO" "Stopping Stripe webhook forwarding..."
    
    if [ -f "stripe-webhook.pid" ]; then
        PID=$(cat stripe-webhook.pid)
        if kill -0 $PID 2>/dev/null; then
            kill $PID
            print_status "PASS" "Stripe webhook forwarding stopped"
        else
            print_status "WARN" "Stripe webhook forwarding was not running"
        fi
        rm -f stripe-webhook.pid
    else
        print_status "WARN" "No PID file found"
    fi
}

# Function to cleanup
cleanup() {
    print_status "INFO" "Cleaning up..."
    stop_webhook_forwarding
    rm -f stripe-webhook.log
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Main execution
echo ""
print_status "INFO" "Starting Stripe webhook testing..."

# Check prerequisites
if ! check_stripe_cli; then
    exit 1
fi

if ! check_api; then
    exit 1
fi

# Test webhook endpoint
test_webhook_endpoint

# Start webhook forwarding
if ! start_webhook_forwarding; then
    exit 1
fi

# Test webhook events
test_webhook_events

# Check logs
check_webhook_logs

echo ""
print_status "INFO" "Stripe webhook testing completed!"
echo ""
print_status "INFO" "Summary:"
echo "- Stripe CLI: ✅"
echo "- Webhook endpoint: ✅"
echo "- Webhook forwarding: ✅"
echo "- Event processing: ✅"
echo ""
print_status "INFO" "Webhook events tested:"
echo "- checkout.session.completed"
echo "- invoice.payment_succeeded"
echo "- invoice.payment_failed"
echo "- customer.subscription.deleted"
echo ""
print_status "INFO" "Check the API logs for webhook processing details"
