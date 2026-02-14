'use client'

import { useState } from 'react'
import { Button } from '@marlin/ui/primitives/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@marlin/ui/primitives/card'
import { cn } from '@marlin/ui/lib/utils'

type PlanId = 'free' | 'pro' | 'premium' | 'institutional'

interface PlanDisplay {
  id: PlanId
  name: string
  priceMonthly: number
  features: string[]
}

const PLANS: PlanDisplay[] = [
  {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    features: [
      '10 indicators per chart',
      '100 alerts',
      'Paper trading',
      '1 watchlist',
      'Delayed data (15min)',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 14.99,
    features: [
      '25 indicators per chart',
      '500 alerts',
      '10 watchlists',
      'Real-time data',
      'Strategy builder',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    priceMonthly: 29.99,
    features: [
      'Unlimited indicators',
      'Unlimited alerts',
      'Live trading',
      'Backtesting',
      'Priority support',
    ],
  },
  {
    id: 'institutional',
    name: 'Institutional',
    priceMonthly: 99.99,
    features: [
      'Everything in Premium',
      'Team workspaces',
      'Compliance tools',
      'VaR & risk analytics',
      'Dedicated support',
    ],
  },
]

export default function BillingSettingsPage() {
  const [currentPlan] = useState<PlanId>('free')
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly')

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Billing</h1>
        <p className="text-sm text-text-secondary">Manage your subscription and billing</p>
      </div>

      {/* Current plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>
            You are on the{' '}
            <span className="font-semibold text-accent">
              {PLANS.find((p) => p.id === currentPlan)?.name}
            </span>{' '}
            plan
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Billing interval toggle */}
      <div className="flex items-center justify-center gap-3">
        <button
          className={cn(
            'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
            billingInterval === 'monthly'
              ? 'bg-accent text-text-primary'
              : 'text-text-secondary hover:text-text-primary',
          )}
          onClick={() => setBillingInterval('monthly')}
        >
          Monthly
        </button>
        <button
          className={cn(
            'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
            billingInterval === 'yearly'
              ? 'bg-accent text-text-primary'
              : 'text-text-secondary hover:text-text-primary',
          )}
          onClick={() => setBillingInterval('yearly')}
        >
          Yearly
          <span className="ml-1.5 text-xs text-trading-green">Save 17%</span>
        </button>
      </div>

      {/* Plan cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan
          const price =
            billingInterval === 'yearly'
              ? (plan.priceMonthly * 10) / 12 // ~17% discount
              : plan.priceMonthly

          return (
            <Card
              key={plan.id}
              className={cn(
                'relative flex flex-col',
                isCurrent && 'ring-2 ring-accent',
              )}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded bg-accent px-2 py-0.5 text-xs font-bold text-text-primary">
                  Current
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{plan.name}</CardTitle>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-price-lg text-text-primary">
                    ${price === 0 ? '0' : price.toFixed(2)}
                  </span>
                  {price > 0 && (
                    <span className="text-xs text-text-muted">/mo</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <ul className="flex-1 space-y-1.5">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-xs text-text-secondary"
                    >
                      <svg
                        className="mt-0.5 h-3 w-3 shrink-0 text-trading-green"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <Button variant="outline" size="sm" disabled className="w-full">
                    Current Plan
                  </Button>
                ) : plan.priceMonthly > (PLANS.find((p) => p.id === currentPlan)?.priceMonthly ?? 0) ? (
                  <Button size="sm" className="w-full">
                    Upgrade
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" className="w-full">
                    Downgrade
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
