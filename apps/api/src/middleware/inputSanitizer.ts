import type { RequestHandler } from 'express';

export const inputSanitizerMiddleware: RequestHandler = (_req, _res, next) => next();
