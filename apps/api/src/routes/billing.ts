import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import {
  createCustomer,
  getCustomer,
  updateCustomer,
  attachPaymentMethod,
  setDefaultPaymentMethod,
  getCustomerPaymentMethods,
  createSubscription,
  getSubscription,
  cancelSubscription,
  reactivateSubscription,
  getCustomerInvoices,
  createBillingPortalSession,
  validateCoupon,
  getPrice,
  getActivePrices,
} from '../services/stripeClient';
import { enqueueLeadSync } from '../services/gohighlevel';

const router = Router();

// Validation schemas
const createSubscriptionSchema = z.object({
  priceId: z.string().min(1, 'Price ID is required'),
  paymentMethodId: z.string().min(1, 'Payment method ID is required'),
  trialPeriodDays: z.number().min(0).max(365).optional(),
  couponId: z.string().optional(),
  prorationBehavior: z.enum(['create_prorations', 'none', 'always_invoice']).default('create_prorations'),
});

const updatePaymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1, 'Payment method ID is required'),
});

const cancelSubscriptionSchema = z.object({
  cancelAtPeriodEnd: z.boolean().default(true),
});

const reactivateSubscriptionSchema = z.object({
  subscriptionId: z.string().min(1, 'Subscription ID is required'),
});

/**
 * POST /api/billing/create-subscription
 * Create a new subscription for the user
 */
router.post('/create-subscription', requireAuth, async (req: Request, res: Response) => {
  try {
    const { priceId, paymentMethodId, trialPeriodDays, couponId, prorationBehavior } = createSubscriptionSchema.parse(req.body);
    const userId = req.user!.id;

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Validate price exists
    const price = await getPrice(priceId);
    if (!price) {
      return res.status(400).json({
        error: 'Invalid price ID',
        code: 'INVALID_PRICE_ID'
      });
    }

    // Validate coupon if provided
    if (couponId) {
      const isValidCoupon = await validateCoupon(couponId);
      if (!isValidCoupon) {
        return res.status(400).json({
          error: 'Invalid or expired coupon',
          code: 'INVALID_COUPON'
        });
      }
    }

    // Check if user already has an active subscription
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['active', 'trialing', 'past_due'] },
      },
    });

    if (existingSubscription) {
      return res.status(400).json({
        error: 'User already has an active subscription',
        code: 'SUBSCRIPTION_EXISTS'
      });
    }

    let customerId: string;

    // Check if user has existing Stripe customer
    const existingCustomer = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (existingCustomer?.stripeCustomerId) {
      customerId = existingCustomer.stripeCustomerId;
      
      // Update customer info if needed
      await updateCustomer(customerId, {
        email: user.email,
        name: user.name,
        metadata: { userId },
      });
    } else {
      // Create new Stripe customer
      const customer = await createCustomer({
        email: user.email,
        name: user.name || undefined,
        userId,
        metadata: { source: 'subscription_creation' },
      });

      customerId = customer.id;

      // Update user with Stripe customer ID
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    // Attach payment method to customer
    await attachPaymentMethod(paymentMethodId, customerId);
    await setDefaultPaymentMethod(customerId, paymentMethodId);

    // Create subscription
    const subscription = await createSubscription({
      customerId,
      priceId,
      paymentMethodId,
      trialPeriodDays,
      couponId,
      prorationBehavior,
      metadata: {
        userId,
        source: 'api',
      },
    });

    // Create subscription record in database
    const dbSubscription = await prisma.subscription.create({
      data: {
        userId,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customerId,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        canceledAt: subscription.canceledAt,
        trialStart: subscription.trialStart,
        trialEnd: subscription.trialEnd,
        priceId,
        metadata: {
          couponId,
          prorationBehavior,
          createdVia: 'api',
        },
      },
    });

    // If trial period, enqueue GoHighLevel notification
    if (trialPeriodDays && trialPeriodDays > 0) {
      try {
        await enqueueLeadSync(
          `trial-${userId}`, // Use a unique lead ID for trial
          userId,
          {
            email: user.email,
            firstName: user.name?.split(' ')[0] || 'User',
            lastName: user.name?.split(' ').slice(1).join(' ') || '',
            source: 'trial_started',
            tags: ['trial', 'subscription'],
            customFields: {
              trialDays: trialPeriodDays,
              priceId,
              subscriptionId: subscription.id,
            },
          },
          'lead_create'
        );
      } catch (error) {
        console.error('Failed to enqueue trial notification:', error);
        // Don't fail the subscription creation if notification fails
      }
    }

    res.json({
      success: true,
      data: {
        subscriptionId: dbSubscription.id,
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        trialStart: subscription.trialStart,
        trialEnd: subscription.trialEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Create subscription error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/billing/subscription
 * Get user's current subscription
 */
router.get('/subscription', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['active', 'trialing', 'past_due', 'canceled'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return res.status(404).json({
        error: 'No subscription found',
        code: 'SUBSCRIPTION_NOT_FOUND'
      });
    }

    // Get latest subscription data from Stripe
    const stripeSubscription = await getSubscription(subscription.stripeSubscriptionId);
    
    if (stripeSubscription) {
      // Update local subscription with latest Stripe data
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: stripeSubscription.status,
          currentPeriodStart: stripeSubscription.currentPeriodStart,
          currentPeriodEnd: stripeSubscription.currentPeriodEnd,
          cancelAtPeriodEnd: stripeSubscription.cancelAtPeriodEnd,
          canceledAt: stripeSubscription.canceledAt,
          trialStart: stripeSubscription.trialStart,
          trialEnd: stripeSubscription.trialEnd,
        },
      });

      subscription.status = stripeSubscription.status;
      subscription.currentPeriodStart = stripeSubscription.currentPeriodStart;
      subscription.currentPeriodEnd = stripeSubscription.currentPeriodEnd;
      subscription.cancelAtPeriodEnd = stripeSubscription.cancelAtPeriodEnd;
      subscription.canceledAt = stripeSubscription.canceledAt;
      subscription.trialStart = stripeSubscription.trialStart;
      subscription.trialEnd = stripeSubscription.trialEnd;
    }

    res.json({
      success: true,
      data: {
        id: subscription.id,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        canceledAt: subscription.canceledAt,
        trialStart: subscription.trialStart,
        trialEnd: subscription.trialEnd,
        priceId: subscription.priceId,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
        metadata: subscription.metadata,
      },
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * PUT /api/billing/subscription/cancel
 * Cancel user's subscription
 */
router.put('/subscription/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const { cancelAtPeriodEnd } = cancelSubscriptionSchema.parse(req.body);
    const userId = req.user!.id;

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['active', 'trialing', 'past_due'] },
      },
    });

    if (!subscription) {
      return res.status(404).json({
        error: 'No active subscription found',
        code: 'SUBSCRIPTION_NOT_FOUND'
      });
    }

    const canceledSubscription = await cancelSubscription(
      subscription.stripeSubscriptionId,
      cancelAtPeriodEnd
    );

    // Update local subscription
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: canceledSubscription.status,
        cancelAtPeriodEnd: canceledSubscription.cancelAtPeriodEnd,
        canceledAt: canceledSubscription.canceledAt,
      },
    });

    // Enqueue cancellation notification
    try {
      await enqueueLeadSync(
        `cancel-${userId}`,
        userId,
        {
          email: req.user!.email,
          firstName: req.user!.name?.split(' ')[0] || 'User',
          lastName: req.user!.name?.split(' ').slice(1).join(' ') || '',
          source: 'subscription_cancelled',
          tags: ['cancellation', 'subscription'],
          customFields: {
            subscriptionId: subscription.stripeSubscriptionId,
            cancelAtPeriodEnd,
            canceledAt: canceledSubscription.canceledAt,
          },
        },
        'lead_create'
      );
    } catch (error) {
      console.error('Failed to enqueue cancellation notification:', error);
    }

    res.json({
      success: true,
      data: {
        subscriptionId: subscription.id,
        status: canceledSubscription.status,
        cancelAtPeriodEnd: canceledSubscription.cancelAtPeriodEnd,
        canceledAt: canceledSubscription.canceledAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Cancel subscription error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * PUT /api/billing/subscription/reactivate
 * Reactivate a canceled subscription
 */
router.put('/subscription/reactivate', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'canceled',
        cancelAtPeriodEnd: true,
      },
    });

    if (!subscription) {
      return res.status(404).json({
        error: 'No canceled subscription found',
        code: 'SUBSCRIPTION_NOT_FOUND'
      });
    }

    const reactivatedSubscription = await reactivateSubscription(subscription.stripeSubscriptionId);

    // Update local subscription
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: reactivatedSubscription.status,
        cancelAtPeriodEnd: reactivatedSubscription.cancelAtPeriodEnd,
        canceledAt: null,
      },
    });

    res.json({
      success: true,
      data: {
        subscriptionId: subscription.id,
        status: reactivatedSubscription.status,
        cancelAtPeriodEnd: reactivatedSubscription.cancelAtPeriodEnd,
      },
    });
  } catch (error) {
    console.error('Reactivate subscription error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * PUT /api/billing/payment-method
 * Update user's default payment method
 */
router.put('/payment-method', requireAuth, async (req: Request, res: Response) => {
  try {
    const { paymentMethodId } = updatePaymentMethodSchema.parse(req.body);
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return res.status(404).json({
        error: 'No Stripe customer found',
        code: 'CUSTOMER_NOT_FOUND'
      });
    }

    await attachPaymentMethod(paymentMethodId, user.stripeCustomerId);
    await setDefaultPaymentMethod(user.stripeCustomerId, paymentMethodId);

    res.json({
      success: true,
      data: {
        message: 'Payment method updated successfully',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Update payment method error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/billing/payment-methods
 * Get user's payment methods
 */
router.get('/payment-methods', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return res.json({
        success: true,
        data: {
          paymentMethods: [],
        },
      });
    }

    const paymentMethods = await getCustomerPaymentMethods(user.stripeCustomerId);

    res.json({
      success: true,
      data: {
        paymentMethods: paymentMethods.map(pm => ({
          id: pm.id,
          type: pm.type,
          card: pm.card,
        })),
      },
    });
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/billing/invoices
 * Get user's invoices
 */
router.get('/invoices', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 10;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return res.json({
        success: true,
        data: {
          invoices: [],
        },
      });
    }

    const invoices = await getCustomerInvoices(user.stripeCustomerId, limit);

    res.json({
      success: true,
      data: {
        invoices: invoices.map(invoice => ({
          id: invoice.id,
          status: invoice.status,
          amountPaid: invoice.amountPaid,
          amountDue: invoice.amountDue,
          currency: invoice.currency,
          hostedInvoiceUrl: invoice.hostedInvoiceUrl,
          invoicePdf: invoice.invoicePdf,
          periodStart: invoice.periodStart,
          periodEnd: invoice.periodEnd,
        })),
      },
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/billing/portal
 * Create Stripe billing portal session
 */
router.post('/portal', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const returnUrl = req.body.returnUrl || `${process.env.FRONTEND_URL}/billing`;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return res.status(404).json({
        error: 'No Stripe customer found',
        code: 'CUSTOMER_NOT_FOUND'
      });
    }

    const session = await createBillingPortalSession({
      customerId: user.stripeCustomerId,
      returnUrl,
    });

    res.json({
      success: true,
      data: {
        url: session.url,
      },
    });
  } catch (error) {
    console.error('Create billing portal error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/billing/prices
 * Get available subscription prices
 */
router.get('/prices', async (req: Request, res: Response) => {
  try {
    const prices = await getActivePrices();

    res.json({
      success: true,
      data: {
        prices: prices.map(price => ({
          id: price.id,
          unitAmount: price.unit_amount,
          currency: price.currency,
          recurring: price.recurring,
          product: price.product,
          metadata: price.metadata,
        })),
      },
    });
  } catch (error) {
    console.error('Get prices error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/billing/customer
 * Get user's Stripe customer information
 */
router.get('/customer', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return res.status(404).json({
        error: 'No Stripe customer found',
        code: 'CUSTOMER_NOT_FOUND'
      });
    }

    const customer = await getCustomer(user.stripeCustomerId);

    if (!customer) {
      return res.status(404).json({
        error: 'Stripe customer not found',
        code: 'STRIPE_CUSTOMER_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        metadata: customer.metadata,
      },
    });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default router;
