# 🚀 Deployment Guide

This guide covers deploying the Social App monorepo to production using Vercel, Railway, and Render.

## 📋 Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   AI Services   │    │   Backend       │
│   (Vercel)      │◄──►│   (Railway)     │◄──►│   (Railway)     │
│   Next.js       │    │   OpenAI API    │    │   Express API   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Meta Ads      │    │   GoHighLevel   │    │   Database      │
│   (Railway)     │    │   (Railway)     │    │   (Railway)     │
│   Integration   │    │   Integration   │    │   PostgreSQL    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🛠️ Prerequisites

- [Vercel CLI](https://vercel.com/cli) installed
- [Railway CLI](https://docs.railway.app/develop/cli) installed
- [Render CLI](https://render.com/docs) (optional)
- [Docker](https://www.docker.com/) installed (for local testing)
- Git repository with all code

## 🔧 Environment Variables

### Required Keys for All Services

```bash
# Database
DATABASE_URL=postgresql://username:password@host:port/database

# API Keys
META_ADS_KEY=your_meta_ads_api_key
GOHIGHLEVEL_KEY=your_gohighlevel_api_key
OPENAI_API_KEY=your_openai_api_key

# Additional keys will be generated during deployment
```

## 📦 Service Deployment

### 1. Frontend (Vercel) - `/social-app/frontend`

#### Setup
```bash
cd social-app/frontend

# Install dependencies
npm install

# Build the project
npm run build
```

#### Deploy to Vercel
```bash
# Login to Vercel
vercel login

# Deploy from the frontend directory
vercel

# Set environment variables
vercel env add NEXTAUTH_URL
vercel env add NEXTAUTH_SECRET
vercel env add DATABASE_URL
vercel env add NEXT_PUBLIC_API_URL
vercel env add NEXT_PUBLIC_SOCIAL_API_URL
```

#### Environment Variables for Vercel
```env
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=your-super-secret-key-here
DATABASE_URL=postgresql://username:password@host:port/database
NEXT_PUBLIC_API_URL=https://your-main-api.railway.app
NEXT_PUBLIC_SOCIAL_API_URL=https://your-social-backend.railway.app
```

### 2. AI Services (Railway) - `/social-app/ai-services`

#### Setup
```bash
cd social-app/ai-services

# Install dependencies
npm install

# Build the project
npm run build
```

#### Deploy to Railway
```bash
# Login to Railway
railway login

# Initialize Railway project
railway init

# Deploy
railway up

# Set environment variables
railway variables set NODE_ENV=production
railway variables set PORT=3002
railway variables set OPENAI_API_KEY=your_openai_api_key
railway variables set ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

#### Docker Deployment (Alternative)
```bash
# Build Docker image
docker build -t social-app-ai-services .

# Run container
docker run -p 3002:3002 \
  -e NODE_ENV=production \
  -e OPENAI_API_KEY=your_key \
  -e ALLOWED_ORIGINS=https://your-frontend.vercel.app \
  social-app-ai-services
```

### 3. Social Backend (Railway) - `/social-app/backend`

#### Setup
```bash
cd social-app/backend

# Install dependencies
npm install

# Build the project
npm run build
```

#### Deploy to Railway
```bash
# Login to Railway
railway login

# Initialize Railway project
railway init

# Deploy
railway up

# Set environment variables
railway variables set NODE_ENV=production
railway variables set PORT=5000
railway variables set API_BASE_URL=https://your-main-api.railway.app
railway variables set ADS_API_BASE_URL=https://your-meta-ads.railway.app
railway variables set SCHEDULER_API_BASE_URL=https://your-main-api.railway.app
railway variables set GOHIGHLEVEL_API_BASE_URL=https://your-gohighlevel.railway.app
railway variables set ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

### 4. Meta Ads Integration (Railway) - `/integrations/meta-ads`

#### Setup
```bash
cd integrations/meta-ads

# Install dependencies
npm install

# Build the project
npm run build
```

#### Deploy to Railway
```bash
# Login to Railway
railway login

# Initialize Railway project
railway init

# Deploy
railway up

# Set environment variables
railway variables set NODE_ENV=production
railway variables set PORT=3003
railway variables set META_ADS_KEY=your_meta_ads_key
railway variables set META_ADS_SECRET=your_meta_ads_secret
railway variables set META_ADS_ACCOUNT_ID=your_account_id
railway variables set ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

### 5. GoHighLevel Integration (Railway) - `/integrations/gohighlevel`

#### Setup
```bash
cd integrations/gohighlevel

# Install dependencies
npm install

# Build the project
npm run build
```

#### Deploy to Railway
```bash
# Login to Railway
railway login

# Initialize Railway project
railway init

# Deploy
railway up

# Set environment variables
railway variables set NODE_ENV=production
railway variables set PORT=3004
railway variables set GOHIGHLEVEL_KEY=your_gohighlevel_key
railway variables set GOHIGHLEVEL_SECRET=your_gohighlevel_secret
railway variables set GOHIGHLEVEL_ACCOUNT_ID=your_account_id
railway variables set ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

## 🐳 Docker Deployment (Alternative)

### Build All Services
```bash
# AI Services
cd social-app/ai-services
docker build -t social-app-ai-services .

# Social Backend
cd ../backend
docker build -t social-app-backend .

# Meta Ads Integration
cd ../../integrations/meta-ads
docker build -t social-app-meta-ads .

# GoHighLevel Integration
cd ../gohighlevel
docker build -t social-app-gohighlevel .
```

### Docker Compose for Local Testing
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  ai-services:
    build: ./social-app/ai-services
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  social-backend:
    build: ./social-app/backend
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - API_BASE_URL=http://main-api:4000
      - ADS_API_BASE_URL=http://meta-ads:3003
      - GOHIGHLEVEL_API_BASE_URL=http://gohighlevel:3004
    depends_on:
      - ai-services
      - meta-ads
      - gohighlevel

  meta-ads:
    build: ./integrations/meta-ads
    ports:
      - "3003:3003"
    environment:
      - NODE_ENV=production
      - META_ADS_KEY=${META_ADS_KEY}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3003/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  gohighlevel:
    build: ./integrations/gohighlevel
    ports:
      - "3004:3004"
    environment:
      - NODE_ENV=production
      - GOHIGHLEVEL_KEY=${GOHIGHLEVEL_KEY}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3004/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd social-app/frontend && npm ci
      - name: Build
        run: cd social-app/frontend && npm run build
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: social-app/frontend

  deploy-ai-services:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Railway
        uses: railwayapp/railway-deploy@v1
        with:
          railway-token: ${{ secrets.RAILWAY_TOKEN }}
          service: ai-services
          working-directory: social-app/ai-services

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Railway
        uses: railwayapp/railway-deploy@v1
        with:
          railway-token: ${{ secrets.RAILWAY_TOKEN }}
          service: social-backend
          working-directory: social-app/backend
```

## 🗄️ Database Setup

### PostgreSQL on Railway
```bash
# Create PostgreSQL database
railway add postgresql

# Get connection string
railway variables

# Run migrations
railway run npx prisma migrate deploy
```

### Environment Variables for Database
```env
DATABASE_URL=postgresql://username:password@host:port/database?schema=public
```

## 🔍 Health Checks

### Service Health Endpoints
- Frontend: `https://your-app.vercel.app/api/health`
- AI Services: `https://your-ai-services.railway.app/health`
- Social Backend: `https://your-backend.railway.app/health`
- Meta Ads: `https://your-meta-ads.railway.app/health`
- GoHighLevel: `https://your-gohighlevel.railway.app/health`

### Health Check Script
```bash
#!/bin/bash
# health-check.sh

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
    echo "✅ $service is healthy"
  else
    echo "❌ $service is down"
  fi
done
```

## 📊 Monitoring & Logs

### Railway Logs
```bash
# View logs for each service
railway logs --service ai-services
railway logs --service social-backend
railway logs --service meta-ads
railway logs --service gohighlevel
```

### Vercel Logs
```bash
# View frontend logs
vercel logs your-app.vercel.app
```

## 🔐 Security Checklist

### Environment Variables
- [ ] All secrets are stored in environment variables
- [ ] No secrets committed to git
- [ ] Different secrets for production vs development
- [ ] Regular rotation of API keys

### CORS Configuration
- [ ] Only allowed origins can access APIs
- [ ] Credentials properly configured
- [ ] No wildcard origins in production

### HTTPS
- [ ] All services use HTTPS
- [ ] SSL certificates are valid
- [ ] HTTP redirects to HTTPS

### Rate Limiting
- [ ] Rate limiting enabled on all APIs
- [ ] Appropriate limits for each endpoint
- [ ] IP-based rate limiting

## 🚨 Troubleshooting

### Common Issues

#### 1. Build Failures
```bash
# Check Node.js version
node --version

# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### 2. Environment Variable Issues
```bash
# Check if variables are set
railway variables

# Verify variable names match exactly
# Check for typos in variable names
```

#### 3. CORS Issues
```bash
# Check ALLOWED_ORIGINS configuration
# Ensure frontend URL is included
# Verify protocol (http vs https)
```

#### 4. Database Connection Issues
```bash
# Test database connection
railway run npx prisma db push

# Check DATABASE_URL format
# Verify database is accessible
```

### Debug Commands
```bash
# Check service status
railway status

# View service details
railway service

# Connect to service shell
railway shell

# View service metrics
railway metrics
```

## 📈 Performance Optimization

### Frontend (Vercel)
- Enable Vercel Analytics
- Use Vercel Edge Functions for API routes
- Optimize images with Next.js Image component
- Enable compression and caching

### Backend Services (Railway)
- Use connection pooling for database
- Implement caching for frequently accessed data
- Monitor memory usage and scale accordingly
- Use CDN for static assets

### Database
- Create appropriate indexes
- Monitor query performance
- Use read replicas for heavy read workloads
- Regular database maintenance

## 🔄 Rollback Procedures

### Vercel Rollback
```bash
# List deployments
vercel ls

# Rollback to previous deployment
vercel rollback [deployment-url]
```

### Railway Rollback
```bash
# List deployments
railway deployments

# Rollback to previous deployment
railway rollback [deployment-id]
```

## 📞 Support

### Service Status
- [Vercel Status](https://vercel-status.com/)
- [Railway Status](https://railway.app/status)
- [Render Status](https://status.render.com/)

### Documentation
- [Vercel Docs](https://vercel.com/docs)
- [Railway Docs](https://docs.railway.app/)
- [Render Docs](https://render.com/docs)

### Getting Help
1. Check service logs first
2. Verify environment variables
3. Test health endpoints
4. Check service status pages
5. Review this deployment guide

## 🎉 Post-Deployment Checklist

- [ ] All services are deployed and healthy
- [ ] Environment variables are configured
- [ ] Database is accessible and migrated
- [ ] Health checks are passing
- [ ] Frontend can communicate with all backends
- [ ] Authentication is working
- [ ] API endpoints are responding
- [ ] Monitoring is set up
- [ ] Logs are accessible
- [ ] SSL certificates are valid
- [ ] CORS is properly configured
- [ ] Rate limiting is active
- [ ] Backup procedures are in place

---

## 🚀 Quick Start Commands

```bash
# Deploy everything
./deploy-all.sh

# Check health
./health-check.sh

# View logs
./view-logs.sh

# Rollback if needed
./rollback.sh
```

This deployment guide provides comprehensive instructions for deploying the Social App to production. Follow the steps carefully and ensure all environment variables are properly configured before going live.



