import { Router } from 'express';
import { getProvider } from '../services/oauth';
import { prisma } from '../lib/prisma';

const router = Router();

// GET /api/oauth/:provider/connect?orgId=...
router.get('/:provider/connect', (req, res) => {
  const { provider } = req.params as { provider: string };
  const orgId = String(req.query.orgId || '');
  if (!orgId) return res.status(400).json({ error: 'orgId required' });
  const impl = getProvider(provider);
  if (!impl) return res.status(404).json({ error: 'Unsupported provider' });
  const url = impl.getAuthorizationUrl({ orgId });
  return res.redirect(url);
});

// GET /api/oauth/:provider/callback?code=...&state=...
router.get('/:provider/callback', async (req, res) => {
  const { provider } = req.params as { provider: string };
  const code = String(req.query.code || '');
  const state = String(req.query.state || '');
  if (!code) return res.status(400).json({ error: 'code required' });

  let orgId = '';
  try {
    const parsed = state ? JSON.parse(state) : {};
    orgId = parsed.orgId || '';
  } catch {
    // ignore
  }
  if (!orgId) return res.status(400).json({ error: 'orgId missing in state' });

  const impl = getProvider(provider);
  if (!impl) return res.status(404).json({ error: 'Unsupported provider' });

  try {
    const token = await impl.exchangeCode({ code, orgId });
    const account = await prisma.socialAccount.upsert({
      where: { provider_providerAccountId: { provider, providerAccountId: token.providerAccountId } },
      update: {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken ?? null,
        expiresAt: token.expiresAt ?? null,
        orgId,
      },
      create: {
        provider,
        providerAccountId: token.providerAccountId,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken ?? null,
        expiresAt: token.expiresAt ?? null,
        orgId,
      },
    });
    return res.json({ status: 'connected', account });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'OAuth failed' });
  }
});

export default router;





