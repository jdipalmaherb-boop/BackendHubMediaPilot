import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { publishQueue, getBackoffOptions } from '../lib/queue';

const router = Router();

// GET /api/posts?orgId=...
router.get('/', async (req, res) => {
  const orgId = String(req.query.orgId || '');
  if (!orgId) return res.status(400).json({ error: 'orgId required' });

  const posts = await prisma.post.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
    include: {
      asset: true, // Include asset details for reference
    },
  });
  return res.json(posts);
});

// POST /api/posts
// Body: { orgId, assetId?, content, platforms: string[], scheduledAt?, finalCaption?, aiScore?, aiTips?, editedAssetUrl?, editedFormat? }
router.post('/', async (req, res) => {
  const { 
    orgId, 
    assetId, 
    content, 
    platforms, 
    scheduledAt,
    finalCaption,
    aiScore,
    aiTips,
    editedAssetUrl,
    editedFormat
  } = req.body ?? {};
  if (!orgId) return res.status(400).json({ error: 'orgId required' });
  if (!content) return res.status(400).json({ error: 'content required' });
  if (!Array.isArray(platforms)) return res.status(400).json({ error: 'platforms must be an array' });

  const status = scheduledAt ? 'SCHEDULED' : 'DRAFT';

  const post = await prisma.post.create({
    data: {
      orgId,
      assetId: assetId || null,
      content,
      platforms: platforms as any,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status: status as any,
      finalCaption: finalCaption || null,
      aiScore: aiScore || null,
      aiTips: aiTips || null,
      editedAssetUrl: editedAssetUrl || null,
      editedFormat: editedFormat || null,
    },
  });

  if (scheduledAt) {
    const delay = Math.max(0, new Date(scheduledAt).getTime() - Date.now());
    await publishQueue.add('publish-post', { postId: post.id }, { delay, ...getBackoffOptions() });
  }

  return res.status(201).json(post);
});

// GET /api/posts/:id - Get specific post with AI data
router.get('/:id', async (req, res) => {
  const postId = String(req.params.id || '');
  if (!postId) return res.status(400).json({ error: 'postId required' });

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      asset: true,
    },
  });
  
  if (!post) return res.status(404).json({ error: 'Post not found' });
  return res.json(post);
});

export default router;


