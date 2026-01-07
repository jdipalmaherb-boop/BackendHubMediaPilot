import type { Express } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { PutObjectCommand, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { createS3Client } from '../lib/s3';
import { prisma } from '../lib/prisma';
import { lookup as lookupMime } from 'mime-types';
import crypto from 'crypto';

type UploadFile = { originalname: string; mimetype: string; buffer: Buffer };


const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function guessAssetType(mime: string | false | null) {
  if (!mime) return 'OTHER';
  if (mime.startsWith('image/')) return 'IMAGE';
  if (mime.startsWith('video/')) return 'VIDEO';
  return 'DOCUMENT';
}

  // POST /api/assets/upload
  router.post('/upload', upload.single('file'), async (req, res) => {
    const orgId = String(req.body?.orgId || '');
    if (!orgId) return res.status(400).json({ error: 'orgId required' });

    const file = req.file as UploadFile | undefined;
    if (!file) return res.status(400).json({ error: 'file required' });

    const s3 = createS3Client();
    const bucket = process.env.S3_BUCKET || 'assets';


  // Ensure bucket exists (idempotent)
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  }

  const ext = (file.originalname.split('.').pop() || '').toLowerCase();
  const hash = crypto.randomBytes(8).toString('hex');
  const key = `${orgId}/${Date.now()}-${hash}${ext ? `.${ext}` : ''}`;
  const contentType = file.mimetype || (lookupMime(ext) || 'application/octet-stream');

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: file.buffer,
    ContentType: contentType,
  }));

  const endpoint = (process.env.S3_ENDPOINT || 'http://localhost:9000').replace(/\/$/, '');
  const url = `${endpoint}/${bucket}/${encodeURIComponent(key)}`;
  const type = guessAssetType(contentType) as any;

  const asset = await prisma.asset.create({
    data: {
      orgId,
      key,
      url,
      type,
    },
  });

  return res.status(201).json(asset);
});

// GET /api/assets?orgId=...
router.get('/', async (req, res) => {
  const orgId = String(req.query.orgId || '');
  if (!orgId) return res.status(400).json({ error: 'orgId required' });

  const assets = await prisma.asset.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(assets);
});

export default router;





