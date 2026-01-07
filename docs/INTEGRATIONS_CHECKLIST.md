# External Integrations Checklist

This document lists all external services required for BackendHub Media Pilot and the environment variables needed for each.
All values shown are SAFE PLACEHOLDERS and must be replaced via environment variables (never committed).

---

## 🔴 Required for Core Functionality

### 1. PostgreSQL Database
**Purpose:** Primary database for application data

**Required Env Vars:**
- DATABASE_URL  
  Format:
  postgresql://user:password@host:port/database?schema=public

Example (local only):
postgresql://postgres:postgres@localhost:5432/backendhub?schema=public

**Verification:**
pnpm --filter api prisma migrate dev

---

### 2. Redis
**Purpose:** Background jobs and queues

**Required Env Vars:**
- REDIS_URL  
  Format:
  redis://host:port

**Verification:**
redis-cli -u $REDIS_URL ping

---

### 3. S3-Compatible Storage
**Purpose:** Media and video storage

**Required Env Vars:**
- S3_BUCKET
- S3_REGION
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY

**Optional:**
- S3_ENDPOINT
- S3_FORCE_PATH_STYLE=true

---

### 4. Firebase Admin SDK
**Purpose:** Authentication verification

**Option A (Recommended):**
- Load service account JSON from secure runtime location (not committed)

**Option B (Env Vars):**
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY

---

### 5. OpenAI API
**Purpose:** Transcription and AI generation

**Required Env Vars:**
- OPENAI_API_KEY

**Optional:**
- WHISPER_MODEL
- GPT_MAX_TOKENS

---

## 🟡 Optional Integrations

### 6. Meta Ads API
**Required Env Vars:**
- META_ACCESS_TOKEN
- META_AD_ACCOUNT_ID

---

### 7. TikTok Content Posting API
**Required Env Vars:**
- TIKTOK_CLIENT_KEY
- TIKTOK_CLIENT_SECRET
- TIKTOK_REDIRECT_URI

---

### 8. YouTube Data API
**Required Env Vars:**
- YOUTUBE_CLIENT_ID
- YOUTUBE_CLIENT_SECRET
- YOUTUBE_REDIRECT_URI

---

### 9. LinkedIn API
**Required Env Vars:**
- LINKEDIN_CLIENT_ID
- LINKEDIN_CLIENT_SECRET
- LINKEDIN_REDIRECT_URI

---

## 🟢 Optional Enhancements

### 10. Slack Notifications
**Purpose:** Alerts and summaries

**Required Env Vars:**
- SLACK_WEBHOOK_URL

NOTE:
Use a placeholder value in docs. Never commit a real webhook.

---

### 11. Sentry
**Required Env Vars:**
- SENTRY_DSN

---

### 12. Replicate (Optional)
**Required Env Vars:**
- REPLICATE_API_KEY

---

## ✅ Local Development Checklist
- PostgreSQL running
- Redis running
- S3 or MinIO configured
- Firebase Admin configured
- OpenAI key set
- Env files created from .env.example
- Database migrations run
- FFmpeg installed

---

## 🔍 Health Check
curl http://localhost:4000/health
Expected response:
{"ok":true}

---

## 🚨 Important Rules
- Never commit secrets
- Never commit .env files
- All production secrets live in deployment platform

