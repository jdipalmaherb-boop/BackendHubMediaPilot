import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

router.get('/', async (_req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

router.post('/', async (req, res) => {
  const { email, name } = req.body ?? {};
  if (!email) return res.status(400).json({ error: 'email required' });
  const user = await prisma.user.create({ data: { email, name } });
  res.status(201).json(user);
});

export default router;


