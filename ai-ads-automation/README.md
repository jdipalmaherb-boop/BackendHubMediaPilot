# 🤖 AI Ads Automation Platform

A production-grade, self-learning ads automation platform that continuously optimizes campaigns across Meta, Google Ads, and TikTok using advanced AI and machine learning.

## 🏗️ Architecture

```
ai-ads-automation/
├── backend/                    # Python FastAPI backend
│   ├── app/
│   │   ├── core/              # Core configuration and utilities
│   │   ├── modules/           # Business logic modules
│   │   │   ├── ad_copy/       # Ad Copy Generator
│   │   │   ├── creative/      # Creative Generator
│   │   │   ├── targeting/     # Targeting & Audience Engine
│   │   │   ├── optimization/  # Optimization Engine
│   │   │   └── platforms/     # Platform Integrations
│   │   ├── api/               # API routes
│   │   ├── models/            # Database models
│   │   ├── services/          # Business services
│   │   └── utils/             # Utilities
│   ├── tests/                 # Backend tests
│   ├── scripts/               # Training and utility scripts
│   └── docker/                # Docker configurations
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── pages/            # Page components
│   │   ├── services/         # API services
│   │   ├── hooks/            # Custom hooks
│   │   └── utils/            # Frontend utilities
│   └── public/               # Static assets
├── data/                      # Data and datasets
├── docs/                      # Documentation
├── docker-compose.yml         # Docker orchestration
└── requirements.txt           # Python dependencies
```

## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL (production) / SQLite (local)

### Local Development

1. **Clone and setup**
```bash
git clone <repo-url>
cd ai-ads-automation
cp .env.example .env
```

2. **Start with Docker Compose**
```bash
docker-compose up -d
```

3. **Or run locally**
```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/ai_ads
SQLITE_URL=sqlite:///./ai_ads.db

# LLM Configuration
OPENAI_API_KEY=your-openai-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4

# Platform APIs
META_ACCESS_TOKEN=your-meta-token
GOOGLE_ADS_DEVELOPER_TOKEN=your-google-token
TIKTOK_ACCESS_TOKEN=your-tiktok-token

# Redis (for caching and queues)
REDIS_URL=redis://localhost:6379

# Security
SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=30

# Monitoring
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=INFO
```

## 🧠 AI Modules

### Ad Copy Generator
- **LLM Integration**: OpenAI-compatible API with configurable providers
- **Sabri Suby Style**: Pain → Solution → Offer → Urgency formula
- **Fine-tuning**: Recipe for instruction-tuned specialist models
- **A/B Testing**: Multiple variations with performance tracking

### Creative Generator
- **Video App Integration**: Hooks to external creative/video apps
- **Synthetic Fallback**: AI-generated creatives when external unavailable
- **Platform Optimization**: Format and dimension optimization per platform
- **Performance Scoring**: AI-based creative performance prediction

### Targeting & Audience Engine
- **ML Optimization**: Contextual bandit for audience selection
- **Lookalike Modeling**: Advanced audience expansion
- **Demographic Analysis**: AI-driven demographic optimization
- **Interest Mapping**: Dynamic interest and behavior targeting

### Optimization Engine
- **Contextual Bandit**: Thompson sampling for immediate optimization
- **RL Policy**: PPO for long-term budget allocation
- **Multi-objective**: Support for ROAS, conversions, reach goals
- **Safety Guards**: Hard spend limits and anomaly detection

## 📊 Platform Integrations

### Meta Ads
- **Complete SDK Integration**: Official Meta Marketing API
- **Campaign Management**: Create, update, pause, resume
- **Audience Management**: Custom and lookalike audiences
- **Creative Upload**: Image and video asset management

### Google Ads
- **Google Ads API**: Full integration with official SDK
- **Search & Display**: Campaign and ad group management
- **YouTube Ads**: Video campaign optimization
- **Shopping Campaigns**: Product feed integration

### TikTok Ads
- **TikTok Marketing API**: Complete integration
- **Video Campaigns**: TikTok-specific optimization
- **Audience Insights**: TikTok demographic data
- **Creative Tools**: TikTok creative generation

## 🔧 Features

### Self-Learning Optimization
- **Continuous Learning**: 24/7 campaign optimization
- **Performance Tracking**: Real-time metric collection
- **Pattern Recognition**: AI identifies successful patterns
- **Automated A/B Testing**: Continuous variation testing

### Safety & Monitoring
- **Spend Limits**: Hard guardrails on budget changes
- **Anomaly Detection**: Automatic throttling on unusual patterns
- **Audit Trail**: Complete action logging and reversibility
- **Real-time Alerts**: Immediate notification of issues

### Dashboard & Analytics
- **Real-time Metrics**: Live campaign performance
- **AI Insights**: Automated recommendations and insights
- **Campaign Controls**: Manual override capabilities
- **Historical Analysis**: Trend analysis and reporting

## 🧪 Testing & Simulation

### Test Suite
- **Unit Tests**: Comprehensive module testing
- **Integration Tests**: End-to-end workflow testing
- **Performance Tests**: Load and stress testing
- **ML Tests**: Model accuracy and performance validation

### Simulation Environment
- **Offline Training**: Safe model training without live spend
- **Synthetic Data**: Realistic ad platform metrics simulation
- **A/B Testing**: Controlled environment for testing
- **Performance Validation**: Model validation before deployment

## 📈 Training & Deployment

### Model Training
```bash
# Run training simulation
python scripts/train_optimizer.py --simulation --epochs 100

# Train with real data (production)
python scripts/train_optimizer.py --production --epochs 1000
```

### Fine-tuning LLM
```bash
# Prepare training data
python scripts/prepare_llm_data.py

# Fine-tune model
python scripts/fine_tune_llm.py --model gpt-4 --data data/llm_training.json
```

## 🚀 Production Deployment

### Docker Deployment
```bash
# Build and deploy
docker-compose -f docker-compose.prod.yml up -d

# Scale services
docker-compose -f docker-compose.prod.yml up -d --scale optimizer=3
```

### Kubernetes Deployment
```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Monitor deployment
kubectl get pods -n ai-ads-automation
```

## 📚 Documentation

- [API Documentation](docs/api.md)
- [AI Module Guide](docs/ai-modules.md)
- [Platform Integration](docs/platforms.md)
- [Training Guide](docs/training.md)
- [Deployment Guide](docs/deployment.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🆘 Support

- [GitHub Issues](https://github.com/your-org/ai-ads-automation/issues)
- [Documentation](docs/)
- [Discord Community](https://discord.gg/ai-ads-automation)

---

**Built with ❤️ for marketers who want to scale with AI**



