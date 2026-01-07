import express from "express";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
import rawBody from "../../middleware/rawBody";
import { env } from "../../env";

const router = express.Router();
const prisma = new PrismaClient();
const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-10-28-acacia",
});

/**
 * POST /webhooks/stripe
 * Receive and process Stripe webhook events
 * 
 * Features:
 * - Raw body verification for signature validation
 * - Idempotent processing (prevents duplicate events)
 * - Secure event construction with Stripe SDK
 */
router.post("/stripe", rawBody, async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const secret = env.STRIPE_WEBHOOK_SECRET;
  
  if (!sig || !secret) {
    return res.status(400).send("Missing Stripe signature or secret");
  }

  // Use raw body for signature verification
  const payload = (req as any).rawBody ?? req.body;
  let event: Stripe.Event;

  try {
    // Construct and verify the event using Stripe SDK
    event = stripe.webhooks.constructEvent(payload, sig, secret);
  } catch (err: any) {
    console.error("Stripe verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Check if event has already been processed (idempotency)
  const existing = await prisma.webhookEvent.findUnique({ 
    where: { eventId: event.id }
  });
  
  if (existing) {
    console.log(`Event ${event.id} already processed - skipping`);
    return res.status(200).json({ received: true, duplicate: true });
  }

  // Record the event for idempotency
  await prisma.webhookEvent.create({
    data: { 
      eventId: event.id, 
      type: event.type, 
      data: event.data.object as any,
      processedAt: new Date(),
    },
  });

  try {
    // Process the event based on type
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
        
      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
        
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
        
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
        
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
        
      default:
        console.log("Unhandled event type:", event.type);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    res.status(500).send("internal_error");
  }
});

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log("Processing checkout.session.completed:", session.id);
  
  const userId = session.metadata?.userId;
  if (!userId) {
    console.warn("No userId in session metadata");
    return;
  }

  // Update user with Stripe customer ID if needed
  if (session.customer) {
    await prisma.user.updateMany({
      where: { id: userId },
      data: { stripeCustomerId: session.customer as string },
    });
  }

  console.log(`Checkout completed for user ${userId}`);
}

/**
 * Handle invoice.payment_succeeded event
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log("Processing invoice.payment_succeeded:", invoice.id);
  
  if (!invoice.subscription) {
    return;
  }

  // Update subscription status if it was past_due
  await prisma.subscription.updateMany({
    where: { 
      stripeSubscriptionId: invoice.subscription as string,
      status: "past_due",
    },
    data: { 
      status: "active",
      updatedAt: new Date(),
    },
  });

  console.log(`Payment succeeded for subscription ${invoice.subscription}`);
}

/**
 * Handle invoice.payment_failed event
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log("Processing invoice.payment_failed:", invoice.id);
  
  if (!invoice.subscription) {
    return;
  }

  // Update subscription status to past_due
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: invoice.subscription as string },
    data: { 
      status: "past_due",
      updatedAt: new Date(),
    },
  });

  console.log(`Payment failed for subscription ${invoice.subscription}`);
}

/**
 * Handle customer.subscription.updated event
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log("Processing customer.subscription.updated:", subscription.id);
  
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.warn("No userId in subscription metadata");
    return;
  }

  // Check if subscription exists
  const existing = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (existing) {
    // Update existing subscription
    await prisma.subscription.update({
      where: { id: existing.id },
      data: {
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        updatedAt: new Date(),
      },
    });
  } else {
    // Create new subscription record
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
      },
    });
  }

  console.log(`Subscription ${subscription.id} updated`);
}

/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log("Processing customer.subscription.deleted:", subscription.id);
  
  // Update subscription status to canceled
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: { 
      status: "canceled",
      canceledAt: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log(`Subscription ${subscription.id} canceled`);
}

export default router;

