import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// DO NOT USE IN PRODUCTION: Development helper to create/update a user session surrogate
router.post('/dev-login', async (req, res) => {
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

export default router;





