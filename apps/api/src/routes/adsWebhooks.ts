import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { env } from '../env.js';
import { log } from '../lib/logger.js';
import { createMetricsQueue } from '../queues/metricsQueue.js';

const router = Router();

router.post('/api/ads/webhook/meta', async (req, res) => {
  const secret = env.META_WEBHOOK_SECRET;
  const rawBody: Buffer | undefined = (req as any).rawBody;
  const bodyBuffer = rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));

  try {
    let signatureVerified = false;

    if (secret) {
      const signatureHeader = (req.headers['x-hub-signature-256'] || req.headers['x-meta-signature'] || req.headers['x-signature']) as string | undefined;

      if (!signatureHeader) {
        return res.status(401).json({
          error: 'missing-signature',
          message: 'Meta webhook signature header is required when META_WEBHOOK_SECRET is set.'
        });
      }

      const normalizedHeader = signatureHeader.startsWith('sha256=')
        ? signatureHeader.substring(7)
        : signatureHeader;

      const expected = crypto.createHmac('sha256', secret).update(bodyBuffer).digest('hex');

      const expectedBuffer = Buffer.from(expected, 'hex');
      const providedBuffer = Buffer.from(normalizedHeader, 'hex');

      if (expectedBuffer.length !== providedBuffer.length) {
        return res.status(401).json({
          error: 'invalid-signature',
          message: 'Signature length mismatch.',
        });
      }

      if (!crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
        return res.status(401).json({
          error: 'invalid-signature',
          message: 'Signature verification failed.',
        });
      }

      signatureVerified = true;
    } else {
      log.warn({ type: 'meta_webhook', reason: 'missing_secret' }, 'META_WEBHOOK_SECRET not set. Accepting webhook in stub mode.');
    }

    const payload = req.body ?? {};
    const campaignId = payload.campaignId ?? payload.campaign_id ?? null;
    const variantId = payload.variantId ?? payload.variant_id ?? null;
    const eventTime = payload.eventTime ?? payload.event_time ?? payload.timestamp ?? new Date().toISOString();

    const ingestRecord = await prisma.adMetricIngest.create({
      data: {
        provider: 'meta',
        payload,
        campaignId,
        variantId,
        signatureValid: signatureVerified,
      },
    });

    const queue = createMetricsQueue();
    await queue.add('ingest-meta-metrics', {
      ingestId: ingestRecord.id,
      provider: 'meta',
      eventTime,
      meta: {
        campaignId,
        variantId,
        signatureVerified,
      },
    });
    await queue.close();

    log.info({
      type: 'meta_webhook_ingest',
      ingestId: ingestRecord.id,
      signatureVerified,
    }, 'Meta ads webhook ingested');

    res.status(202).json({
      success: true,
      ingestId: ingestRecord.id,
      signatureVerified: secret ? signatureVerified : 'skipped',
      queued: true,
    });
  } catch (error) {
    log.error({
      type: 'meta_webhook_error',
      error: error instanceof Error ? error.message : error,
    }, 'Failed to handle meta webhook');

    res.status(500).json({
      error: 'internal-error',
      message: 'Failed to handle meta webhook',
    });
  }
});

export default router;
