type SecurityLevel = 'low' | 'medium' | 'high';

export const log = {
  info: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.debug,

  // Used by src/index.ts for security-related events (e.g., blocked CORS)
  security: (scope: string, event: string, level: SecurityLevel, data?: Record<string, unknown>) => {
    console.warn('[security]', { scope, event, level, ...(data ? { data } : {}) });
  },
};
