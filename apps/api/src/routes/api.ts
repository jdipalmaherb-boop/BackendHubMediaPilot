import { Router } from 'express';
import { prisma } from '../lib/prisma';
import adsRouter from './ads';
import landingRouter from './landing';
import notificationsRouter from './notifications';
import { generateCaptions, editContent, generateFeedback } from 'ai-services';

const router = Router();

// Alias: /api/auth/dev-login -> forwards to same behavior as /api-auth/dev-login
// DO NOT USE IN PRODUCTION
router.post('/auth/dev-login', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Not available in production' });
  }

  const { email, name } = req.body ?? {};
  if (!email) return res.status(400).json({ error: 'email required' });

  const user = await prisma.user.upsert({
    where: { email },
    update: { name },
    create: { email, name },
  });

  return res.json(user);
});

// POST /api/ai/caption
// Body: { text: string, assetId?: string }
router.post('/ai/caption', async (req, res) => {
  const { text, assetId } = req.body ?? {};
  if (!text) return res.status(400).json({ error: 'text required' });

  // Placeholder for OpenAI call. Replace with real API integration.
  const suggestions = [
    `${text} ✨`,
    `Quick take: ${text} #startup`,
    `Hot off the press: ${text} 🔥`,
  ];

  return res.json({ suggestions, assetId: assetId || null });
});

// POST /api/ai/feedback
// Body: { text: string, assetId?: string }
router.post('/ai/feedback', async (req, res) => {
  const body = req.body ?? {};
  if (!body?.type || !body?.sourceUrl || !body?.caption) {
    return res.status(400).json({ error: 'type, sourceUrl, caption required' });
  }
  try {
    const feedback = await generateFeedback(body);
    return res.json({ feedback });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Failed to generate feedback' });
  }
});

// POST /api/ai/captions
// Body: { description: string, rawCaption?: string }
router.post('/ai/captions', async (req, res) => {
  const { description, rawCaption } = req.body ?? {};
  if (!description) return res.status(400).json({ error: 'description required' });
  try {
    const captions = await generateCaptions({ description, rawCaption });
    return res.json({ captions });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Failed to generate captions' });
  }
});

// POST /api/ai/edit
// Body: { type: 'video'|'image', sourceUrl: string, description: string, rawCaption?: string, formats?: ('square'|'portrait'|'landscape')[] }
router.post('/ai/edit', async (req, res) => {
  const body = req.body ?? {};
  if (!body?.type || !body?.sourceUrl || !body?.description) {
    return res.status(400).json({ error: 'type, sourceUrl, description required' });
  }
  try {
    const output = await editContent(body);
    return res.json(output);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Failed to edit content' });
  }
});

// Nest ads under /api/ads
router.use('/ads', adsRouter);
router.use('/landing', landingRouter);
router.use('/notifications', notificationsRouter);

export default router;


