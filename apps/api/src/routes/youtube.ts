import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

/**
 * GET /youtube/status?orgId=...
 * Simple sanity check to confirm YouTube is connected
 */
router.get('/status', async (req, res) => {
  const orgId = String(req.query.orgId || '');
  if (!orgId) {
    return res.status(400).json({ error: 'orgId required' });
  }

  const account = await prisma.socialAccount.findFirst({
    where: {
      provider: 'youtube',
      orgId,
    },
  });

  if (!account) {
    return res.json({ connected: false });
  }

  return res.json({
    connected: true,
    expiresAt: account.expiresAt,
  });
});

export default router;
