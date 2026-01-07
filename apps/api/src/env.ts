import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Optional runtime config
  SENTRY_DSN: z.string().optional(),
  FRONTEND_URL: z.string().url().optional(),
  MAX_REQUEST_SIZE: z.string().optional(),
});

export const env = envSchema.parse(process.env);
