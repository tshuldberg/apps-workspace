import Stripe from 'stripe'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
if (!stripeSecretKey) {
  console.warn('STRIPE_SECRET_KEY not set — billing features will be unavailable')
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null

export type PlanId = 'free' | 'pro' | 'premium' | 'institutional'

export interface PlanInfo {
  id: PlanId
  name: string
  priceMonthly: number
  priceYearly: number
  stripePriceMonthly: string | null
  stripePriceYearly: string | null
  features: string[]
}

export const PLANS: Record<PlanId, PlanInfo> = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    stripePriceMonthly: null,
    stripePriceYearly: null,
    features: [
      '10 indicators per chart',
      '100 alerts',
      'Paper trading',
      '1 watchlist',
      'Delayed data (15min)',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 14.99,
    priceYearly: 149.99,
    stripePriceMonthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? '',
    stripePriceYearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID ?? '',
    features: [
      '25 indicators per chart',
      '500 alerts',
      'Paper trading',
      '10 watchlists',
      'Real-time data',
      'Strategy builder',
    ],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    priceMonthly: 29.99,
    priceYearly: 299.99,
    stripePriceMonthly: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID ?? '',
    stripePriceYearly: process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID ?? '',
    features: [
      'Unlimited indicators',
      'Unlimited alerts',
      'Paper + live trading',
      'Unlimited watchlists',
      'Real-time data',
      'Strategy builder + backtesting',
      'Priority support',
    ],
  },
  institutional: {
    id: 'institutional',
    name: 'Institutional',
    priceMonthly: 99.99,
    priceYearly: 999.99,
    stripePriceMonthly: process.env.STRIPE_INST_MONTHLY_PRICE_ID ?? '',
    stripePriceYearly: process.env.STRIPE_INST_YEARLY_PRICE_ID ?? '',
    features: [
      'Everything in Premium',
      'Team workspaces',
      'Compliance tools',
      'VaR & risk analytics',
      'TWAP/VWAP execution',
      'Dedicated support',
      'Custom integrations',
    ],
  },
}

export class BillingService {
  /**
   * Create a Stripe Checkout session for plan upgrade.
   */
  async createCheckoutSession(params: {
    clerkUserId: string
    email: string
    planId: PlanId
    interval: 'monthly' | 'yearly'
    successUrl: string
    cancelUrl: string
  }): Promise<{ url: string }> {
    if (!stripe) {
      throw new Error('Stripe is not configured')
    }

    const plan = PLANS[params.planId]
    if (!plan) {
      throw new Error(`Invalid plan: ${params.planId}`)
    }

    const priceId =
      params.interval === 'monthly' ? plan.stripePriceMonthly : plan.stripePriceYearly

    if (!priceId) {
      throw new Error(`No Stripe price configured for ${params.planId} ${params.interval}`)
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: params.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        clerkUserId: params.clerkUserId,
        planId: params.planId,
      },
    })

    return { url: session.url! }
  }

  /**
   * Create a Stripe billing portal session for plan management.
   */
  async createPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }> {
    if (!stripe) {
      throw new Error('Stripe is not configured')
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })

    return { url: session.url }
  }

  /**
   * Handle Stripe webhook events for subscription lifecycle.
   * Returns the clerkUserId and new tier if the tier should be updated.
   */
  async handleWebhookEvent(
    payload: string | Buffer,
    signature: string,
  ): Promise<{ clerkUserId: string; tier: PlanId } | null> {
    if (!stripe) {
      throw new Error('Stripe is not configured')
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not set')
    }

    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const clerkUserId = session.metadata?.clerkUserId
        const planId = session.metadata?.planId as PlanId | undefined

        if (clerkUserId && planId) {
          return { clerkUserId, tier: planId }
        }
        break
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const clerkUserId = subscription.metadata?.clerkUserId

        if (clerkUserId) {
          return { clerkUserId, tier: 'free' }
        }
        break
      }
    }

    return null
  }

  /**
   * Get plan info for all available plans.
   */
  getPlans(): PlanInfo[] {
    return Object.values(PLANS)
  }

  /**
   * Get info for a specific plan.
   */
  getPlan(planId: PlanId): PlanInfo | undefined {
    return PLANS[planId]
  }
}
