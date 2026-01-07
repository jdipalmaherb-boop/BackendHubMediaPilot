import type { RequestHandler } from 'express';
import { randomUUID } from 'crypto';

export const loggingMiddleware: RequestHandler = (req, _res, next) => {
  (req as any).requestId = (req as any).requestId ?? randomUUID();
  next();
};

export const errorLoggingMiddleware: RequestHandler = (_req, _res, next) => next();

export const noLoggingMiddleware: RequestHandler = (_req, _res, next) => next();
