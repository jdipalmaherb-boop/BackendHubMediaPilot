import request from 'supertest';
import express from 'express';
import Stripe from 'stripe';
import stripeRouter from '../../routes/webhooks/stripe';
import { prisma } from '../../lib/prisma';

// Mock Stripe client
jest.mock('../../services/stripeClient', () => ({
  verifyWebhookSignature: jest.fn(),
  getSubscription: jest.fn(),
  getInvoice: jest.fn(),
}));

// Mock email service
jest.mock('../../services/email', () => ({
  sendEmail: jest.fn(),
}));

// Mock GoHighLevel service
jest.mock('../../services/gohighlevel', () => ({
  enqueueLeadSync: jest.fn(),
}));

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    webhookEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    subscription: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { verifyWebhookSignature } from '../../services/stripeClient';

describe('Stripe Webhook Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    
    // Simulate raw body capture
    app.use(express.json({
      verify: (req: any, res, buf) => {
        req.rawBody = buf;
      }
    }));
    
    app.use('/webhooks', stripeRouter);
    
    jest.clearAllMocks();
  });

  describe('POST /webhooks/stripe', () => {
    it('should reject webhook without signature', async () => {
      const response = await request(app)
        .post('/webhooks/stripe')
        .send({ type: 'test.event' });

      expect(response.status).toBe(400);
      expect(response.text).toContain('Missing signature');
    });

    it('should reject webhook with invalid signature', async () => {
      (verifyWebhookSignature as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', 'invalid_signature')
        .send({ type: 'test.event' });

      expect(response.status).toBe(400);
      expect(response.text).toContain('Invalid signature');
    });

    it('should verify webhook signature with raw body', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_test_123',
        object: 'event',
        type: 'checkout.session.completed',
        created: Date.now() / 1000,
        livemode: false,
        api_version: '2023-10-16',
        pending_webhooks: 0,
        request: null,
        data: {
          object: {
            id: 'cs_test_123',
            object: 'checkout.session',
            mode: 'subscription',
            customer: 'cus_test_123',
            metadata: {
              userId: 'user_123',
            },
          } as Stripe.Checkout.Session,
        },
      };

      (verifyWebhookSignature as jest.Mock).mockReturnValue(mockEvent);
      (prisma.webhookEvent.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.webhookEvent.create as jest.Mock).mockResolvedValue({});
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
        stripeCustomerId: null,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', 'valid_signature')
        .send(mockEvent);

      expect(response.status).toBe(200);
      expect(verifyWebhookSignature).toHaveBeenCalled();
      
      // Verify that raw body was passed to signature verification
      const callArgs = (verifyWebhookSignature as jest.Mock).mock.calls[0];
      expect(Buffer.isBuffer(callArgs[0])).toBe(true);
    });

    it('should handle idempotency - reject duplicate webhook events', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_duplicate_123',
        object: 'event',
        type: 'checkout.session.completed',
        created: Date.now() / 1000,
        livemode: false,
        api_version: '2023-10-16',
        pending_webhooks: 0,
        request: null,
        data: {
          object: {} as Stripe.Checkout.Session,
        },
      };

      (verifyWebhookSignature as jest.Mock).mockReturnValue(mockEvent);
      (prisma.webhookEvent.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing_event',
        eventId: 'evt_duplicate_123',
        type: 'checkout.session.completed',
        processedAt: new Date(),
      });

      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', 'valid_signature')
        .send(mockEvent);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        received: true,
        duplicate: true,
      });
      
      // Verify that webhook was not processed again
      expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
    });

    it('should process checkout.session.completed event', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_checkout_123',
        object: 'event',
        type: 'checkout.session.completed',
        created: Date.now() / 1000,
        livemode: false,
        api_version: '2023-10-16',
        pending_webhooks: 0,
        request: null,
        data: {
          object: {
            id: 'cs_test_123',
            object: 'checkout.session',
            mode: 'subscription',
            customer: 'cus_test_123',
            metadata: {
              userId: 'user_123',
            },
          } as Stripe.Checkout.Session,
        },
      };

      (verifyWebhookSignature as jest.Mock).mockReturnValue(mockEvent);
      (prisma.webhookEvent.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.webhookEvent.create as jest.Mock).mockResolvedValue({});
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
        stripeCustomerId: null,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', 'valid_signature')
        .send(mockEvent);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
      
      // Verify webhook event was stored
      expect(prisma.webhookEvent.create).toHaveBeenCalledWith({
        data: {
          eventId: 'evt_checkout_123',
          type: 'checkout.session.completed',
          data: mockEvent.data.object,
          processedAt: expect.any(Date),
        },
      });
    });

    it('should process invoice.payment_failed event', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_invoice_failed_123',
        object: 'event',
        type: 'invoice.payment_failed',
        created: Date.now() / 1000,
        livemode: false,
        api_version: '2023-10-16',
        pending_webhooks: 0,
        request: null,
        data: {
          object: {
            id: 'in_test_123',
            object: 'invoice',
            subscription: 'sub_test_123',
            amount_due: 2999,
            currency: 'usd',
            hosted_invoice_url: 'https://invoice.stripe.com/test',
          } as Stripe.Invoice,
        },
      };

      (verifyWebhookSignature as jest.Mock).mockReturnValue(mockEvent);
      (prisma.webhookEvent.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.webhookEvent.create as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', 'valid_signature')
        .send(mockEvent);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
    });
  });

  describe('Webhook Security', () => {
    it('should reject webhook without raw body', async () => {
      // Create app without raw body capture
      const appWithoutRawBody = express();
      appWithoutRawBody.use(express.json()); // No verify callback
      appWithoutRawBody.use('/webhooks', stripeRouter);

      const response = await request(appWithoutRawBody)
        .post('/webhooks/stripe')
        .set('stripe-signature', 'valid_signature')
        .send({ type: 'test.event' });

      expect(response.status).toBe(400);
      expect(response.text).toContain('Missing raw body');
    });

    it('should use raw body for signature verification (not parsed JSON)', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_security_test_123',
        object: 'event',
        type: 'customer.subscription.created',
        created: Date.now() / 1000,
        livemode: false,
        api_version: '2023-10-16',
        pending_webhooks: 0,
        request: null,
        data: {
          object: {} as Stripe.Subscription,
        },
      };

      let capturedBody: any;
      (verifyWebhookSignature as jest.Mock).mockImplementation((body, sig, secret) => {
        capturedBody = body;
        return mockEvent;
      });

      (prisma.webhookEvent.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.webhookEvent.create as jest.Mock).mockResolvedValue({});

      await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', 'valid_signature')
        .send({ test: 'data' });

      // Verify that raw body (Buffer) was passed, not parsed JSON object
      expect(Buffer.isBuffer(capturedBody)).toBe(true);
      expect(capturedBody).not.toEqual({ test: 'data' });
    });
  });
});

