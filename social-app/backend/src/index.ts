import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { boostPostRouter } from './routes/boostPost.js';
import { landingRouter } from './routes/landing.js';
import { leadRouter } from './routes/lead.js';
import { notificationRouter } from './routes/notifications.js';
import { postsRouter } from './routes/posts.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 5000);

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'social-app-backend' });
});

// Routes
app.use('/api/ads', boostPostRouter);
app.use('/api/landing', landingRouter);
app.use('/api/lead', leadRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/posts', postsRouter);

app.listen(port, () => {
  console.log(`Social App Backend listening on http://localhost:${port}`);
});
