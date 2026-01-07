import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../../lib/prisma';
import { verifyWebhookSignature, getSubscription, getInvoice } from '../../services/stripeClient';
import { enqueueLeadSync } from '../../services/gohighlevel';
import { sendEmail } from '../../services/email';
import { env } from '../../env';

const router = Router();

// Stripe webhook endpoint
router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error('Missing Stripe signature or webhook secret');
    return res.status(400).send('Missing signature or webhook secret');
  }

  // Get raw body for signature verification
  const rawBody = (req as any).rawBody;
  if (!rawBody) {
    console.error('Missing raw body for webhook verification');
    return res.status(400).send('Missing raw body');
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature using raw body
    event = verifyWebhookSignature(rawBody, sig, webhookSecret);
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return res.status(400).send('Invalid signature');
  }

  // Check for idempotency - prevent duplicate webhook processing
  const eventId = event.id;
  const existingEvent = await prisma.webhookEvent.findUnique({
    where: { eventId },
  });

  if (existingEvent) {
    console.log(`Webhook ${eventId} already processed - returning success`);
    return res.json({ received: true, duplicate: true });
  }

  // Store webhook event for idempotency
  await prisma.webhookEvent.create({
    data: {
      eventId,
      type: event.type,
      data: event.data.object as any,
      processedAt: new Date(),
    },
  });

  console.log(`Received webhook: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.upcoming':
        await handleInvoiceUpcoming(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;

      case 'payment_method.attached':
        await handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
        break;

      case 'payment_method.detached':
        await handlePaymentMethodDetached(event.data.object as Stripe.PaymentMethod);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// Handle successful checkout session completion
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('Processing checkout.session.completed:', session.id);

  try {
    const userId = session.metadata?.userId;
    if (!userId) {
      console.error('No userId in checkout session metadata');
      return;
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      console.error(`User not found: ${userId}`);
      return;
    }

    // Update user with Stripe customer ID if not already set
    if (session.customer && !user.stripeCustomerId) {
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: session.customer as string },
      });
    }

    // If this was a subscription checkout, the subscription will be handled by subscription.created webhook
    if (session.mode === 'subscription') {
      console.log(`Subscription checkout completed for user ${userId}`);
      
      // Send welcome email
      try {
        await sendEmail({
          to: user.email,
          subject: 'Welcome to BackendHub!',
          template: 'welcome',
          data: {
            name: user.name || 'User',
            email: user.email,
          },
        });
      } catch (error) {
        console.error('Failed to send welcome email:', error);
      }

      // Enqueue GoHighLevel notification
      try {
        await enqueueLeadSync(
          `welcome-${userId}`,
          userId,
          {
            email: user.email,
            firstName: user.name?.split(' ')[0] || 'User',
            lastName: user.name?.split(' ').slice(1).join(' ') || '',
            source: 'subscription_started',
            tags: ['welcome', 'subscription', 'new_customer'],
            customFields: {
              subscriptionMode: 'checkout',
              sessionId: session.id,
            },
          },
          'lead_create'
        );
      } catch (error) {
        console.error('Failed to enqueue welcome notification:', error);
      }
    }
  } catch (error) {
    console.error('Error handling checkout.session.completed:', error);
  }
}

// Handle subscription creation
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('Processing customer.subscription.created:', subscription.id);

  try {
    const userId = subscription.metadata?.userId;
    if (!userId) {
      console.error('No userId in subscription metadata');
      return;
    }

    // Check if subscription already exists
    const existingSubscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (existingSubscription) {
      console.log(`Subscription ${subscription.id} already exists in database`);
      return;
    }

    // Create subscription record
    await prisma.subscription.create({
      data: {
        userId,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer as string,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        priceId: subscription.items.data[0]?.price.id || '',
        metadata: {
          createdVia: 'webhook',
          stripeEvent: 'subscription.created',
        },
      },
    });

    console.log(`Created subscription record for user ${userId}`);
  } catch (error) {
    console.error('Error handling customer.subscription.created:', error);
  }
}

// Handle subscription updates
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('Processing customer.subscription.updated:', subscription.id);

  try {
    const dbSubscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!dbSubscription) {
      console.error(`Subscription ${subscription.id} not found in database`);
      return;
    }

    // Update subscription record
    await prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        metadata: {
          ...dbSubscription.metadata,
          lastUpdatedVia: 'webhook',
          stripeEvent: 'subscription.updated',
        },
      },
    });

    console.log(`Updated subscription ${subscription.id}`);
  } catch (error) {
    console.error('Error handling customer.subscription.updated:', error);
  }
}

// Handle subscription deletion/cancellation
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Processing customer.subscription.deleted:', subscription.id);

  try {
    const dbSubscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id },
      include: { user: true },
    });

    if (!dbSubscription) {
      console.error(`Subscription ${subscription.id} not found in database`);
      return;
    }

    // Update subscription status
    await prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        status: 'canceled',
        canceledAt: new Date(),
        metadata: {
          ...dbSubscription.metadata,
          canceledVia: 'webhook',
          stripeEvent: 'subscription.deleted',
        },
      },
    });

    // Send cancellation email
    try {
      await sendEmail({
        to: dbSubscription.user.email,
        subject: 'Your subscription has been canceled',
        template: 'subscription_canceled',
        data: {
          name: dbSubscription.user.name || 'User',
          subscriptionId: subscription.id,
          canceledAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Failed to send cancellation email:', error);
    }

    // Enqueue GoHighLevel notification
    try {
      await enqueueLeadSync(
        `canceled-${dbSubscription.userId}`,
        dbSubscription.userId,
        {
          email: dbSubscription.user.email,
          firstName: dbSubscription.user.name?.split(' ')[0] || 'User',
          lastName: dbSubscription.user.name?.split(' ').slice(1).join(' ') || '',
          source: 'subscription_canceled',
          tags: ['cancellation', 'subscription', 'churned'],
          customFields: {
            subscriptionId: subscription.id,
            canceledAt: new Date().toISOString(),
            canceledVia: 'webhook',
          },
        },
        'lead_create'
      );
    } catch (error) {
      console.error('Failed to enqueue cancellation notification:', error);
    }

    console.log(`Canceled subscription ${subscription.id}`);
  } catch (error) {
    console.error('Error handling customer.subscription.deleted:', error);
  }
}

// Handle successful invoice payment
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('Processing invoice.payment_succeeded:', invoice.id);

  try {
    if (!invoice.subscription) {
      console.log('Invoice is not associated with a subscription');
      return;
    }

    const subscription = await getSubscription(invoice.subscription as string);
    if (!subscription) {
      console.error(`Subscription ${invoice.subscription} not found`);
      return;
    }

    const userId = subscription.metadata?.userId;
    if (!userId) {
      console.error('No userId in subscription metadata');
      return;
    }

    // Update subscription status if it was past_due
    const dbSubscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (dbSubscription && dbSubscription.status === 'past_due') {
      await prisma.subscription.update({
        where: { id: dbSubscription.id },
        data: {
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
        },
      });

      // Send payment success email
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (user) {
        try {
          await sendEmail({
            to: user.email,
            subject: 'Payment successful - Your subscription is active',
            template: 'payment_success',
            data: {
              name: user.name || 'User',
              amount: invoice.amount_paid / 100, // Convert from cents
              currency: invoice.currency,
              subscriptionId: subscription.id,
            },
          });
        } catch (error) {
          console.error('Failed to send payment success email:', error);
        }
      }
    }

    console.log(`Processed successful payment for subscription ${subscription.id}`);
  } catch (error) {
    console.error('Error handling invoice.payment_succeeded:', error);
  }
}

// Handle failed invoice payment
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Processing invoice.payment_failed:', invoice.id);

  try {
    if (!invoice.subscription) {
      console.log('Invoice is not associated with a subscription');
      return;
    }

    const subscription = await getSubscription(invoice.subscription as string);
    if (!subscription) {
      console.error(`Subscription ${invoice.subscription} not found`);
      return;
    }

    const userId = subscription.metadata?.userId;
    if (!userId) {
      console.error('No userId in subscription metadata');
      return;
    }

    // Update subscription status to past_due
    const dbSubscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id },
      include: { user: true },
    });

    if (dbSubscription) {
      await prisma.subscription.update({
        where: { id: dbSubscription.id },
        data: {
          status: 'past_due',
          metadata: {
            ...dbSubscription.metadata,
            lastPaymentFailedAt: new Date().toISOString(),
            failedInvoiceId: invoice.id,
          },
        },
      });

      // Send payment failure email
      try {
        await sendEmail({
          to: dbSubscription.user.email,
          subject: 'Payment failed - Please update your payment method',
          template: 'payment_failed',
          data: {
            name: dbSubscription.user.name || 'User',
            amount: invoice.amount_due / 100, // Convert from cents
            currency: invoice.currency,
            subscriptionId: subscription.id,
            hostedInvoiceUrl: invoice.hosted_invoice_url,
          },
        });
      } catch (error) {
        console.error('Failed to send payment failure email:', error);
      }

      // Enqueue GoHighLevel notification for dunning workflow
      try {
        await enqueueLeadSync(
          `payment-failed-${userId}`,
          userId,
          {
            email: dbSubscription.user.email,
            firstName: dbSubscription.user.name?.split(' ')[0] || 'User',
            lastName: dbSubscription.user.name?.split(' ').slice(1).join(' ') || '',
            source: 'payment_failed',
            tags: ['payment_failed', 'dunning', 'at_risk'],
            customFields: {
              subscriptionId: subscription.id,
              invoiceId: invoice.id,
              amountDue: invoice.amount_due,
              currency: invoice.currency,
              failedAt: new Date().toISOString(),
            },
          },
          'lead_create'
        );
      } catch (error) {
        console.error('Failed to enqueue payment failure notification:', error);
      }
    }

    console.log(`Processed failed payment for subscription ${subscription.id}`);
  } catch (error) {
    console.error('Error handling invoice.payment_failed:', error);
  }
}

// Handle upcoming invoice
async function handleInvoiceUpcoming(invoice: Stripe.Invoice) {
  console.log('Processing invoice.upcoming:', invoice.id);

  try {
    if (!invoice.subscription) {
      console.log('Invoice is not associated with a subscription');
      return;
    }

    const subscription = await getSubscription(invoice.subscription as string);
    if (!subscription) {
      console.error(`Subscription ${invoice.subscription} not found`);
      return;
    }

    const userId = subscription.metadata?.userId;
    if (!userId) {
      console.error('No userId in subscription metadata');
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      console.error(`User ${userId} not found`);
      return;
    }

    // Send upcoming invoice email
    try {
      await sendEmail({
        to: user.email,
        subject: 'Upcoming invoice - Your subscription will renew soon',
        template: 'invoice_upcoming',
        data: {
          name: user.name || 'User',
          amount: invoice.amount_due / 100, // Convert from cents
          currency: invoice.currency,
          subscriptionId: subscription.id,
          nextPaymentDate: new Date(invoice.period_end * 1000).toISOString(),
        },
      });
    } catch (error) {
      console.error('Failed to send upcoming invoice email:', error);
    }

    console.log(`Processed upcoming invoice for subscription ${subscription.id}`);
  } catch (error) {
    console.error('Error handling invoice.upcoming:', error);
  }
}

// Handle trial will end
async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  console.log('Processing customer.subscription.trial_will_end:', subscription.id);

  try {
    const userId = subscription.metadata?.userId;
    if (!userId) {
      console.error('No userId in subscription metadata');
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      console.error(`User ${userId} not found`);
      return;
    }

    // Send trial ending email
    try {
      await sendEmail({
        to: user.email,
        subject: 'Your trial is ending soon',
        template: 'trial_ending',
        data: {
          name: user.name || 'User',
          subscriptionId: subscription.id,
          trialEndDate: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        },
      });
    } catch (error) {
      console.error('Failed to send trial ending email:', error);
    }

    // Enqueue GoHighLevel notification
    try {
      await enqueueLeadSync(
        `trial-ending-${userId}`,
        userId,
        {
          email: user.email,
          firstName: user.name?.split(' ')[0] || 'User',
          lastName: user.name?.split(' ').slice(1).join(' ') || '',
          source: 'trial_ending',
          tags: ['trial', 'conversion', 'at_risk'],
          customFields: {
            subscriptionId: subscription.id,
            trialEndDate: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
          },
        },
        'lead_create'
      );
    } catch (error) {
      console.error('Failed to enqueue trial ending notification:', error);
    }

    console.log(`Processed trial ending notification for subscription ${subscription.id}`);
  } catch (error) {
    console.error('Error handling customer.subscription.trial_will_end:', error);
  }
}

// Handle payment method attached
async function handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod) {
  console.log('Processing payment_method.attached:', paymentMethod.id);

  try {
    const customerId = paymentMethod.customer as string;
    
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!user) {
      console.log(`No user found for customer ${customerId}`);
      return;
    }

    // Log payment method attachment
    console.log(`Payment method ${paymentMethod.id} attached to customer ${customerId}`);
  } catch (error) {
    console.error('Error handling payment_method.attached:', error);
  }
}

// Handle payment method detached
async function handlePaymentMethodDetached(paymentMethod: Stripe.PaymentMethod) {
  console.log('Processing payment_method.detached:', paymentMethod.id);

  try {
    const customerId = paymentMethod.customer as string;
    
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!user) {
      console.log(`No user found for customer ${customerId}`);
      return;
    }

    // Log payment method detachment
    console.log(`Payment method ${paymentMethod.id} detached from customer ${customerId}`);
  } catch (error) {
    console.error('Error handling payment_method.detached:', error);
  }
}

export default router;
