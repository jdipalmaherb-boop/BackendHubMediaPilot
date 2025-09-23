import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { env } from './env';
import path from 'path';
import { loadRoutes } from './lib/routeLoader';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Health (simple redundancy with /ping)
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Auto-load routes from src/routes
const routesDir = path.join(__dirname, 'routes');
await loadRoutes(app, routesDir);

const port = env.PORT;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
});


