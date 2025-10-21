import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { env } from './env';
import path from 'path';
import { loadRoutes } from './lib/routeLoader';
import { cookieParserMiddleware } from './middleware/cookieParser';
import { loggingMiddleware, errorLoggingMiddleware, noLoggingMiddleware } from './middleware/requestId';
import { rateLimitMiddleware, postRequestRateLimit } from './middleware/rateLimit';
import { inputSanitizerMiddleware } from './middleware/inputSanitizer';
import { log } from './lib/logger';
import verifyFirebaseToken from './middleware/verifyFirebaseToken.js';

dotenv.config();

// Initialize Sentry if DSN is provided
if (env.SENTRY_DSN) {
  try {
    const Sentry = require('@sentry/node');
    
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

// CORS configuration with restrictive whitelist
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://backendhub.com',
  'https://www.backendhub.com',
  'https://app.backendhub.com',
  'https://staging.backendhub.com',
];

// Add environment-specific origins
if (env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.push('http://localhost:3000', 'http://127.0.0.1:3000');
}

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
      log.security('cors_blocked', 'medium', {
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

// Health check endpoint (no logging to avoid noise)
app.get('/health', noLoggingMiddleware, (_req, res) => res.json({ status: 'ok' }));

// Example protected route using Firebase authentication
app.use("/api/protected", verifyFirebaseToken, (req, res) => {
  res.json({ message: `Hello ${(req as any).user.email}, you are authenticated!` });
});

// Post-request rate limiting (for skipSuccessfulRequests)
app.use(postRequestRateLimit);

// Error handling middleware (must be after routes)
app.use(errorLoggingMiddleware);

// Auto-load routes from src/routes
const routesDir = path.join(__dirname, 'routes');
await loadRoutes(app, routesDir);

const port = env.PORT;
app.listen(port, () => {
  log.info({ 
    port, 
    env: env.NODE_ENV,
    sentryEnabled: !!env.SENTRY_DSN,
    type: 'server_start' 
  }, `API server started on port ${port}`);
});


