## BackendHub Monorepo

- apps/web: Next.js 14, TypeScript, Tailwind, NextAuth (minimal)
- apps/api: Express.js, TypeScript, Prisma, PostgreSQL

### Scripts
- `pnpm dev:web` – start Next.js web dev server
- `pnpm dev:api` – start API dev server (ts-node/tsx)
- `pnpm dev` – run both concurrently

### Setup
1. Install pnpm and Node 18+.
2. Run `pnpm install` at repo root.
3. Copy `apps/web/env.example` to `apps/web/.env` and edit.
4. Copy `apps/api/env.example` to `apps/api/.env` and edit.
5. For API DB: `pnpm --filter api prisma:generate` then `pnpm --filter api prisma:migrate`.

### Notes
- Uses workspace scripts and filters for clean DX.

