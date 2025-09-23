import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// GET /api/landing/:slug
router.get('/:slug', async (req, res) => {
  const slug = String(req.params.slug || '');
  const lp = await prisma.landingPage.findUnique({ where: { slug } });
  if (!lp) return res.status(404).json({ error: 'Not found' });
  return res.json(lp);
});

// POST /api/landing
router.post('/', async (req, res) => {
  const { orgId, slug, headline, subtext, ctaText, ctaUrl } = req.body ?? {};
  if (!orgId || !slug || !headline || !subtext || !ctaText || !ctaUrl) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const created = await prisma.landingPage.create({
    data: { orgId, slug, headline, subtext, ctaText, ctaUrl },
  });
  return res.status(201).json(created);
});

export default router;





