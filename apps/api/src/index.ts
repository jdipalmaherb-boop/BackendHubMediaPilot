import 'dotenv/config';
import * as Sentry from "@sentry/node";

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { env } from './env.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadRoutes } from './lib/routeLoader.js';
import { cookieParserMiddleware } from './middleware/cookieParser.js';
import { loggingMiddleware, errorLoggingMiddleware, noLoggingMiddleware } from './middleware/requestId.js';
import { rateLimitMiddleware, postRequestRateLimit } from './middleware/rateLimit.js';
import { inputSanitizerMiddleware } from './middleware/inputSanitizer.js';
import { log } from './lib/logger.js';
import verifyFirebaseToken from './middleware/verifyFirebaseToken.js';
import tiktokOAuthRouter from './routes/tiktokOAuth';

// Get the directory name for ES modules
// __dirname is available in CommonJS output


// Initialize Sentry if DSN is provided
if (env.SENTRY_DSN) {
  try {
    
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
      debug: env.NODE_ENV === 'development',
      beforeSend(event) {
        // Add request ID to Sentry events if available
        if (event.request && event.request.headers) {
          const reqId = event.request.headers['x-request-id'];
          if (reqId) {
            event.tags = { ...event.tags, reqId };
          }
        }
        return event;
      },
    });

    log.info({ type: 'sentry_init' }, 'Sentry initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
  }
}

const app = express();
const prisma = new PrismaClient();

// Security middleware - must be applied first
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS configuration with environment-based whitelist
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'];

// Add FRONTEND_URL if specified and not already in the list
if (env.FRONTEND_URL && !ALLOWED_ORIGINS.includes(env.FRONTEND_URL)) {
  ALLOWED_ORIGINS.push(env.FRONTEND_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      log.security('system', 'cors_blocked', 'medium', {
        origin,
        allowedOrigins: ALLOWED_ORIGINS,
      });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
  exposedHeaders: ['x-request-id'],
  maxAge: 86400, // 24 hours
}));

// Apply logging middleware to all routes except health checks
app.use(loggingMiddleware);

// Rate limiting middleware
app.use(rateLimitMiddleware);

// Input sanitization middleware
app.use(inputSanitizerMiddleware);

// Body parsing with size limits
app.use(express.json({ 
  limit: env.MAX_REQUEST_SIZE || '10mb',
  verify: (req, res, buf) => {
    // Store raw body for webhook signature verification
    (req as any).rawBody = buf;
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: env.MAX_REQUEST_SIZE || '10mb' 
}));

app.use(cookieParserMiddleware);

app.get('/health', noLoggingMiddleware, (_req, res) => res.json({ ok: true }));

// Test authentication endpoint
app.get('/api/test-auth', verifyFirebaseToken, (req, res) => {
  const user = (req as any).user;
  res.json({ uid: user.uid, email: user.email });
});

// Example protected route using Firebase authentication
app.use("/api/protected", verifyFirebaseToken, (req, res) => {
  res.json({ message: `Hello ${(req as any).user.email}, you are authenticated!` });
});

// Post-request rate limiting (for skipSuccessfulRequests)
app.use(postRequestRateLimit);

// Error handling middleware (must be after routes)
app.use('/oauth', tiktokOAuthRouter);

app.use(errorLoggingMiddleware);


  // Auto-load routes from src/routes
  const routesDir = path.join(__dirname, 'routes');

  async function main() {
    if (process.env.LOAD_ROUTES === "true") {
      await loadRoutes(app, routesDir);
    }

    // Debug: show which DB Railway is using (redacted password)
    app.get('/debug/db', (_req, res) => {
      const url = process.env.DATABASE_URL || '';
      const redacted = url.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
      return res.json({ databaseUrl: redacted });
    });

    // Debug: count orgs
    app.get('/debug/org-count', async (_req, res) => {
      try {
        const count = await prisma.organization.count();
        return res.json({ ok: true, count });
      } catch (e: any) {
        return res.status(500).json({ ok: false, error: String(e?.message || e) });
      }
    });

    // Debug: list orgs (copy an orgId)
    app.get('/debug/orgs', async (_req, res) => {
      try {
        const orgs = await prisma.organization.findMany({
          select: { id: true, name: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        });
        return res.json({ ok: true, orgs });
      } catch (e: any) {
        return res.status(500).json({ ok: false, error: String(e?.message || e) });
      }
    });

    // Debug: create an org in Railway DB
    app.post('/debug/create-org', async (req, res) => {
      try {
        const name = String((req as any).body?.name || 'Default Org');
        const org = await prisma.organization.create({ data: { name } });
        return res.json({ ok: true, org });
      } catch (e: any) {
        return res.status(500).json({ ok: false, error: String(e?.message || e) });
      }
    });

    const port = Number(process.env.PORT) || 4000;
    app.listen(port, '0.0.0.0', () => {
      log.info({
        port,
        env: env.NODE_ENV,
        sentryEnabled: !!env.SENTRY_DSN,
        type: 'server_start'
      }, `API server started on port ${port}`);
    });
  }

  main().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
