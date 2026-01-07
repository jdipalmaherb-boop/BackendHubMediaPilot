import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import { testPrisma, testUtils, mockStripe } from '../../__tests__/setup';

// Mock the prisma client
jest.mock('../../lib/prisma', () => ({
  prisma: testPrisma,
}));

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripe);
});

// Import routes after mocking
import stripeWebhookRoutes from '../../routes/webhooks/stripe';

const app = express();
app.use(express.json());
app.use(stripeWebhookRoutes);

// Helper function to create Stripe webhook signature
function createStripeSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

describe('Stripe Webhook Routes', () => {
  beforeEach(async () => {
    await testUtils.cleanup();
  });

  describe('POST /webhooks/stripe', () => {
    const webhookSecret = 'whsec_test_secret';
    process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;

    it('should handle checkout.session.completed event', async () => {
      const user = await testUtils.createTestUser({
        email: 'checkout@example.com',
      });

      const eventPayload = {
        id: 'evt_test_webhook',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_session',
            customer: 'cus_test_customer',
            customer_email: user.email,
            subscription: 'sub_test_subscription',
            metadata: {
              userId: user.id,
            },
          },
        },
      };

      const payload = JSON.stringify(eventPayload);
      const signature = createStripeSignature(payload, webhookSecret);

      mockStripe.webhooks.constructEvent.mockReturnValue(eventPayload);
      mockStripe.customers.retrieve.mockResolvedValue({
        id: 'cus_test_customer',
        email: user.email,
      });
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_test_subscription',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        items: {
          data: [{ price: { id: 'price_test' } }],
        },
      });

      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', signature)
        .send(payload)
        .expect(200);

      expect(response.body).toEqual({ received: true });

      // Verify subscription was created
      const subscription = await testPrisma.subscription.findFirst({
        where: { userId: user.id },
      });
      expect(subscription).toBeTruthy();
      expect(subscription?.stripeSubscriptionId).toBe('sub_test_subscription');
      expect(subscription?.status).toBe('active');
    });

    it('should handle invoice.payment_succeeded event', async () => {
      const user = await testUtils.createTestUser({
        email: 'invoice@example.com',
      });

      // Create existing subscription
      await testPrisma.subscription.create({
        data: {
          userId: user.id,
          stripeCustomerId: 'cus_test_customer',
          stripeSubscriptionId: 'sub_test_subscription',
          status: 'active',
          planId: 'price_test',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const eventPayload = {
        id: 'evt_test_invoice',
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_test_invoice',
            subscription: 'sub_test_subscription',
            amount_paid: 2999, // $29.99
            currency: 'usd',
            status: 'paid',
          },
        },
      };

      const payload = JSON.stringify(eventPayload);
      const signature = createStripeSignature(payload, webhookSecret);

      mockStripe.webhooks.constructEvent.mockReturnValue(eventPayload);
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_test_subscription',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        items: {
          data: [{ price: { id: 'price_test' } }],
        },
      });

      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', signature)
        .send(payload)
        .expect(200);

      expect(response.body).toEqual({ received: true });

      // Verify subscription was updated
      const subscription = await testPrisma.subscription.findFirst({
        where: { userId: user.id },
      });
      expect(subscription?.status).toBe('active');
    });

    it('should handle invoice.payment_failed event', async () => {
      const user = await testUtils.createTestUser({
        email: 'failed@example.com',
      });

      // Create existing subscription
      await testPrisma.subscription.create({
        data: {
          userId: user.id,
          stripeCustomerId: 'cus_test_customer',
          stripeSubscriptionId: 'sub_test_subscription',
          status: 'active',
          planId: 'price_test',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const eventPayload = {
        id: 'evt_test_failed',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_test_failed',
            subscription: 'sub_test_subscription',
            amount_due: 2999,
            currency: 'usd',
            status: 'open',
            attempt_count: 1,
          },
        },
      };

      const payload = JSON.stringify(eventPayload);
      const signature = createStripeSignature(payload, webhookSecret);

      mockStripe.webhooks.constructEvent.mockReturnValue(eventPayload);
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_test_subscription',
        status: 'past_due',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        items: {
          data: [{ price: { id: 'price_test' } }],
        },
      });

      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', signature)
        .send(payload)
        .expect(200);

      expect(response.body).toEqual({ received: true });

      // Verify subscription was updated to past_due
      const subscription = await testPrisma.subscription.findFirst({
        where: { userId: user.id },
      });
      expect(subscription?.status).toBe('past_due');
    });

    it('should handle customer.subscription.deleted event', async () => {
      const user = await testUtils.createTestUser({
        email: 'cancelled@example.com',
      });

      // Create existing subscription
      await testPrisma.subscription.create({
        data: {
          userId: user.id,
          stripeCustomerId: 'cus_test_customer',
          stripeSubscriptionId: 'sub_test_subscription',
          status: 'active',
          planId: 'price_test',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const eventPayload = {
        id: 'evt_test_cancelled',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_test_subscription',
            customer: 'cus_test_customer',
            status: 'canceled',
            canceled_at: Math.floor(Date.now() / 1000),
          },
        },
      };

      const payload = JSON.stringify(eventPayload);
      const signature = createStripeSignature(payload, webhookSecret);

      mockStripe.webhooks.constructEvent.mockReturnValue(eventPayload);

      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', signature)
        .send(payload)
        .expect(200);

      expect(response.body).toEqual({ received: true });

      // Verify subscription was cancelled
      const subscription = await testPrisma.subscription.findFirst({
        where: { userId: user.id },
      });
      expect(subscription?.status).toBe('canceled');
      expect(subscription?.canceledAt).toBeTruthy();
    });

    it('should handle customer.subscription.updated event', async () => {
      const user = await testUtils.createTestUser({
        email: 'updated@example.com',
      });

      // Create existing subscription
      await testPrisma.subscription.create({
        data: {
          userId: user.id,
          stripeCustomerId: 'cus_test_customer',
          stripeSubscriptionId: 'sub_test_subscription',
          status: 'active',
          planId: 'price_test',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const eventPayload = {
        id: 'evt_test_updated',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_test_subscription',
            customer: 'cus_test_customer',
            status: 'active',
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            cancel_at_period_end: true,
            items: {
              data: [{ price: { id: 'price_new' } }],
            },
          },
        },
      };

      const payload = JSON.stringify(eventPayload);
      const signature = createStripeSignature(payload, webhookSecret);

      mockStripe.webhooks.constructEvent.mockReturnValue(eventPayload);

      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', signature)
        .send(payload)
        .expect(200);

      expect(response.body).toEqual({ received: true });

      // Verify subscription was updated
      const subscription = await testPrisma.subscription.findFirst({
        where: { userId: user.id },
      });
      expect(subscription?.cancelAtPeriodEnd).toBe(true);
      expect(subscription?.planId).toBe('price_new');
    });

    it('should reject webhook with invalid signature', async () => {
      const eventPayload = {
        id: 'evt_test_invalid',
        type: 'checkout.session.completed',
        data: { object: {} },
      };

      const payload = JSON.stringify(eventPayload);
      const invalidSignature = 'invalid_signature';

      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', invalidSignature)
        .send(payload)
        .expect(400);

      expect(response.body.error).toContain('Invalid signature');
    });

    it('should handle unknown event types gracefully', async () => {
      const eventPayload = {
        id: 'evt_test_unknown',
        type: 'unknown.event.type',
        data: { object: {} },
      };

      const payload = JSON.stringify(eventPayload);
      const signature = createStripeSignature(payload, webhookSecret);

      mockStripe.webhooks.constructEvent.mockReturnValue(eventPayload);

      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', signature)
        .send(payload)
        .expect(200);

      expect(response.body).toEqual({ received: true });
    });

    it('should handle webhook processing errors gracefully', async () => {
      const user = await testUtils.createTestUser({
        email: 'error@example.com',
      });

      const eventPayload = {
        id: 'evt_test_error',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_error',
            customer: 'cus_test_customer',
            customer_email: user.email,
            subscription: 'sub_test_subscription',
            metadata: {
              userId: user.id,
            },
          },
        },
      };

      const payload = JSON.stringify(eventPayload);
      const signature = createStripeSignature(payload, webhookSecret);

      mockStripe.webhooks.constructEvent.mockReturnValue(eventPayload);
      mockStripe.customers.retrieve.mockRejectedValue(new Error('Stripe API error'));

      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', signature)
        .send(payload)
        .expect(500);

      expect(response.body.error).toContain('Webhook processing failed');
    });

    it('should handle missing webhook secret', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;

      const eventPayload = {
        id: 'evt_test_no_secret',
        type: 'checkout.session.completed',
        data: { object: {} },
      };

      const payload = JSON.stringify(eventPayload);
      const signature = createStripeSignature(payload, 'fallback_secret');

      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', signature)
        .send(payload)
        .expect(500);

      expect(response.body.error).toContain('Webhook secret not configured');
    });
  });

  describe('Webhook Idempotency', () => {
    it('should handle duplicate webhook events', async () => {
      const user = await testUtils.createTestUser({
        email: 'duplicate@example.com',
      });

      const eventPayload = {
        id: 'evt_test_duplicate',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_duplicate',
            customer: 'cus_test_customer',
            customer_email: user.email,
            subscription: 'sub_test_subscription',
            metadata: {
              userId: user.id,
            },
          },
        },
      };

      const payload = JSON.stringify(eventPayload);
      const signature = createStripeSignature(payload, webhookSecret);

      mockStripe.webhooks.constructEvent.mockReturnValue(eventPayload);
      mockStripe.customers.retrieve.mockResolvedValue({
        id: 'cus_test_customer',
        email: user.email,
      });
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_test_subscription',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        items: {
          data: [{ price: { id: 'price_test' } }],
        },
      });

      // Process webhook first time
      await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', signature)
        .send(payload)
        .expect(200);

      // Process same webhook again
      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', signature)
        .send(payload)
        .expect(200);

      expect(response.body).toEqual({ received: true });

      // Verify only one subscription was created
      const subscriptions = await testPrisma.subscription.findMany({
        where: { userId: user.id },
      });
      expect(subscriptions).toHaveLength(1);
    });
  });
});
