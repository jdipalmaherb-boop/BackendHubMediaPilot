import { Router, Request, Response } from 'express';
import { env } from '../env.js';
import { log } from '../lib/logger.js';

const router = Router();

/**
 * POST /api/base44/webhook
 * Webhook endpoint for Base44 to send events
 * 
 * Verifies the x-base44-signature header matches BASE44_WEBHOOK_SECRET
 * 
 * Expected header:
 *   x-base44-signature: <BASE44_WEBHOOK_SECRET>
 * 
 * Response:
 *   - 200: Webhook verified and processed successfully
 *   - 401: Invalid or missing signature
 *   - 500: Server error
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // Get signature from header
    const signature = req.headers['x-base44-signature'] as string;
    const webhookSecret = env.BASE44_WEBHOOK_SECRET;

    // Verify signature exists
    if (!signature) {
      log.security('base44_webhook', 'missing_signature', 'medium', {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
      return res.status(401).json({
        error: 'Missing signature',
        message: 'x-base44-signature header is required',
        code: 'MISSING_SIGNATURE'
      });
    }

    // Verify signature matches secret
    if (signature !== webhookSecret) {
      log.security('base44_webhook', 'invalid_signature', 'high', {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        providedSignature: signature.substring(0, 8) + '...', // Log only first 8 chars for security
      });
      return res.status(401).json({
        error: 'Invalid signature',
        message: 'x-base44-signature does not match expected secret',
        code: 'INVALID_SIGNATURE'
      });
    }

    // Signature is valid - process webhook
    const webhookData = req.body;
    
    log.info({
      type: 'base44_webhook',
      event: webhookData?.event || 'unknown',
      timestamp: new Date().toISOString(),
    }, 'Base44 webhook received and verified');

    // TODO: Process webhook data here
    // Example: webhookData.event, webhookData.data, etc.
    
    // Return success response
    res.status(200).json({
      success: true,
      message: 'Webhook received and verified',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error({
      type: 'base44_webhook',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Base44 webhook processing error');

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default router;

