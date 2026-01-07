import Stripe from 'stripe';
import { env } from '../env';

// Initialize Stripe client
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: true,
});

export interface StripeCustomer {
  id: string;
  email: string;
  name?: string;
  metadata: Record<string, string>;
}

export interface StripeSubscription {
  id: string;
  customerId: string;
  status: Stripe.Subscription.Status;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  metadata: Record<string, string>;
  items: Array<{
    priceId: string;
    quantity: number;
  }>;
}

export interface StripeInvoice {
  id: string;
  customerId: string;
  subscriptionId?: string;
  status: Stripe.Invoice.Status;
  amountPaid: number;
  amountDue: number;
  currency: string;
  hostedInvoiceUrl?: string;
  invoicePdf?: string;
  periodStart: Date;
  periodEnd: Date;
  metadata: Record<string, string>;
}

export interface StripePaymentMethod {
  id: string;
  customerId: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  metadata: Record<string, string>;
}

export interface CreateCustomerOptions {
  email: string;
  name?: string;
  userId: string;
  metadata?: Record<string, string>;
}

export interface CreateSubscriptionOptions {
  customerId: string;
  priceId: string;
  paymentMethodId?: string;
  trialPeriodDays?: number;
  couponId?: string;
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';
  metadata?: Record<string, string>;
}

export interface CreateBillingPortalSessionOptions {
  customerId: string;
  returnUrl: string;
}

// Customer operations
export async function createCustomer(options: CreateCustomerOptions): Promise<StripeCustomer> {
  try {
    const customer = await stripe.customers.create({
      email: options.email,
      name: options.name,
      metadata: {
        userId: options.userId,
        ...options.metadata,
      },
    });

    return {
      id: customer.id,
      email: customer.email!,
      name: customer.name || undefined,
      metadata: customer.metadata,
    };
  } catch (error) {
    console.error('Failed to create Stripe customer:', error);
    throw new Error('Failed to create customer');
  }
}

export async function getCustomer(customerId: string): Promise<StripeCustomer | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    
    if (customer.deleted) {
      return null;
    }

    return {
      id: customer.id,
      email: customer.email!,
      name: customer.name || undefined,
      metadata: customer.metadata,
    };
  } catch (error) {
    console.error('Failed to get Stripe customer:', error);
    return null;
  }
}

export async function updateCustomer(customerId: string, updates: {
  email?: string;
  name?: string;
  metadata?: Record<string, string>;
}): Promise<StripeCustomer> {
  try {
    const customer = await stripe.customers.update(customerId, {
      email: updates.email,
      name: updates.name,
      metadata: updates.metadata,
    });

    return {
      id: customer.id,
      email: customer.email!,
      name: customer.name || undefined,
      metadata: customer.metadata,
    };
  } catch (error) {
    console.error('Failed to update Stripe customer:', error);
    throw new Error('Failed to update customer');
  }
}

// Payment method operations
export async function attachPaymentMethod(paymentMethodId: string, customerId: string): Promise<StripePaymentMethod> {
  try {
    const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    return {
      id: paymentMethod.id,
      customerId: customerId,
      type: paymentMethod.type,
      card: paymentMethod.card ? {
        brand: paymentMethod.card.brand,
        last4: paymentMethod.card.last4,
        expMonth: paymentMethod.card.exp_month,
        expYear: paymentMethod.card.exp_year,
      } : undefined,
      metadata: paymentMethod.metadata,
    };
  } catch (error) {
    console.error('Failed to attach payment method:', error);
    throw new Error('Failed to attach payment method');
  }
}

export async function setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
  try {
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  } catch (error) {
    console.error('Failed to set default payment method:', error);
    throw new Error('Failed to set default payment method');
  }
}

export async function getCustomerPaymentMethods(customerId: string): Promise<StripePaymentMethod[]> {
  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    return paymentMethods.data.map(pm => ({
      id: pm.id,
      customerId: customerId,
      type: pm.type,
      card: pm.card ? {
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
      } : undefined,
      metadata: pm.metadata,
    }));
  } catch (error) {
    console.error('Failed to get customer payment methods:', error);
    return [];
  }
}

// Subscription operations
export async function createSubscription(options: CreateSubscriptionOptions): Promise<StripeSubscription> {
  try {
    const subscriptionData: Stripe.SubscriptionCreateParams = {
      customer: options.customerId,
      items: [{ price: options.priceId }],
      metadata: {
        userId: options.metadata?.userId || '',
        ...options.metadata,
      },
      expand: ['latest_invoice.payment_intent'],
    };

    if (options.paymentMethodId) {
      subscriptionData.default_payment_method = options.paymentMethodId;
    }

    if (options.trialPeriodDays) {
      subscriptionData.trial_period_days = options.trialPeriodDays;
    }

    if (options.couponId) {
      subscriptionData.coupon = options.couponId;
    }

    if (options.prorationBehavior) {
      subscriptionData.proration_behavior = options.prorationBehavior;
    }

    const subscription = await stripe.subscriptions.create(subscriptionData);

    return {
      id: subscription.id,
      customerId: subscription.customer as string,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : undefined,
      trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : undefined,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined,
      metadata: subscription.metadata,
      items: subscription.items.data.map(item => ({
        priceId: item.price.id,
        quantity: item.quantity || 1,
      })),
    };
  } catch (error) {
    console.error('Failed to create Stripe subscription:', error);
    throw new Error('Failed to create subscription');
  }
}

export async function getSubscription(subscriptionId: string): Promise<StripeSubscription | null> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    return {
      id: subscription.id,
      customerId: subscription.customer as string,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : undefined,
      trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : undefined,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined,
      metadata: subscription.metadata,
      items: subscription.items.data.map(item => ({
        priceId: item.price.id,
        quantity: item.quantity || 1,
      })),
    };
  } catch (error) {
    console.error('Failed to get Stripe subscription:', error);
    return null;
  }
}

export async function cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true): Promise<StripeSubscription> {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: cancelAtPeriodEnd,
    });

    if (!cancelAtPeriodEnd) {
      await stripe.subscriptions.cancel(subscriptionId);
    }

    return {
      id: subscription.id,
      customerId: subscription.customer as string,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : undefined,
      trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : undefined,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined,
      metadata: subscription.metadata,
      items: subscription.items.data.map(item => ({
        priceId: item.price.id,
        quantity: item.quantity || 1,
      })),
    };
  } catch (error) {
    console.error('Failed to cancel Stripe subscription:', error);
    throw new Error('Failed to cancel subscription');
  }
}

export async function reactivateSubscription(subscriptionId: string): Promise<StripeSubscription> {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });

    return {
      id: subscription.id,
      customerId: subscription.customer as string,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : undefined,
      trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : undefined,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined,
      metadata: subscription.metadata,
      items: subscription.items.data.map(item => ({
        priceId: item.price.id,
        quantity: item.quantity || 1,
      })),
    };
  } catch (error) {
    console.error('Failed to reactivate Stripe subscription:', error);
    throw new Error('Failed to reactivate subscription');
  }
}

// Invoice operations
export async function getInvoice(invoiceId: string): Promise<StripeInvoice | null> {
  try {
    const invoice = await stripe.invoices.retrieve(invoiceId);

    return {
      id: invoice.id,
      customerId: invoice.customer as string,
      subscriptionId: invoice.subscription as string | undefined,
      status: invoice.status!,
      amountPaid: invoice.amount_paid,
      amountDue: invoice.amount_due,
      currency: invoice.currency,
      hostedInvoiceUrl: invoice.hosted_invoice_url || undefined,
      invoicePdf: invoice.invoice_pdf || undefined,
      periodStart: new Date(invoice.period_start * 1000),
      periodEnd: new Date(invoice.period_end * 1000),
      metadata: invoice.metadata,
    };
  } catch (error) {
    console.error('Failed to get Stripe invoice:', error);
    return null;
  }
}

export async function getCustomerInvoices(customerId: string, limit: number = 10): Promise<StripeInvoice[]> {
  try {
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit,
    });

    return invoices.data.map(invoice => ({
      id: invoice.id,
      customerId: invoice.customer as string,
      subscriptionId: invoice.subscription as string | undefined,
      status: invoice.status!,
      amountPaid: invoice.amount_paid,
      amountDue: invoice.amount_due,
      currency: invoice.currency,
      hostedInvoiceUrl: invoice.hosted_invoice_url || undefined,
      invoicePdf: invoice.invoice_pdf || undefined,
      periodStart: new Date(invoice.period_start * 1000),
      periodEnd: new Date(invoice.period_end * 1000),
      metadata: invoice.metadata,
    }));
  } catch (error) {
    console.error('Failed to get customer invoices:', error);
    return [];
  }
}

// Billing portal
export async function createBillingPortalSession(options: CreateBillingPortalSessionOptions): Promise<{ url: string }> {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: options.customerId,
      return_url: options.returnUrl,
    });

    return { url: session.url };
  } catch (error) {
    console.error('Failed to create billing portal session:', error);
    throw new Error('Failed to create billing portal session');
  }
}

// Coupon operations
export async function getCoupon(couponId: string): Promise<Stripe.Coupon | null> {
  try {
    const coupon = await stripe.coupons.retrieve(couponId);
    return coupon;
  } catch (error) {
    console.error('Failed to get Stripe coupon:', error);
    return null;
  }
}

export async function validateCoupon(couponId: string): Promise<boolean> {
  try {
    const coupon = await stripe.coupons.retrieve(couponId);
    return coupon.valid;
  } catch (error) {
    console.error('Failed to validate Stripe coupon:', error);
    return false;
  }
}

// Price operations
export async function getPrice(priceId: string): Promise<Stripe.Price | null> {
  try {
    const price = await stripe.prices.retrieve(priceId);
    return price;
  } catch (error) {
    console.error('Failed to get Stripe price:', error);
    return null;
  }
}

export async function getActivePrices(): Promise<Stripe.Price[]> {
  try {
    const prices = await stripe.prices.list({
      active: true,
      expand: ['data.product'],
    });
    return prices.data;
  } catch (error) {
    console.error('Failed to get active Stripe prices:', error);
    return [];
  }
}

// Webhook signature verification
export function verifyWebhookSignature(payload: string, signature: string, secret: string): Stripe.Event {
  try {
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    throw new Error('Invalid webhook signature');
  }
}

export default stripe;
