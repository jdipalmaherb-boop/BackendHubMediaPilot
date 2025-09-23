import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// POST /api/ads/meta/create
router.post('/meta/create', async (req, res) => {
  const { orgId, name, budget } = req.body ?? {};
  if (!orgId) return res.status(400).json({ error: 'orgId required' });
  if (!name) return res.status(400).json({ error: 'name required' });
  if (!budget) return res.status(400).json({ error: 'budget required' });

  // eslint-disable-next-line no-console
  console.log('Creating dummy Meta ad campaign', { orgId, name, budget });

  const campaign = await prisma.adCampaign.create({
    data: {
      orgId,
      platform: 'meta',
      name,
      budget,
      status: 'CREATED' as any,
      results: {},
    },
  });

  return res.status(201).json(campaign);
});

// POST /api/ads/meta/test
router.post('/meta/test', async (req, res) => {
  const { campaignId, variants } = req.body ?? {};
  if (!campaignId) return res.status(400).json({ error: 'campaignId required' });

  // eslint-disable-next-line no-console
  console.log('Simulating Meta ad variant tests', { campaignId, variants });

  const updated = await prisma.adCampaign.update({
    where: { id: campaignId },
    data: {
      status: 'TESTING' as any,
      results: {
        variants: variants || [
          { name: 'A', ctr: Math.random().toFixed(2), cpc: (Math.random() * 1.5 + 0.5).toFixed(2) },
          { name: 'B', ctr: Math.random().toFixed(2), cpc: (Math.random() * 1.5 + 0.5).toFixed(2) },
        ],
        summary: 'Dummy test results: choose highest CTR',
      },
    },
  });

  return res.json(updated);
});

export default router;





