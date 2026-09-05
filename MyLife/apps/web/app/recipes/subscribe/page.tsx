'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CreditCard, ShieldCheck, Users } from 'lucide-react';

const T = {
  bg: '#131318',
  surfaceLow: '#1B1B20',
  surface: '#1F1F25',
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  green: '#22C55E',
  gold: '#C9894D',
  dimText: 'rgba(228,225,233,0.45)',
} as const;

function SubscribePageContent() {
  const params = useSearchParams();
  const chefName = params.get('chefName')?.trim() || null;

  return (
    <main
      style={{
        minHeight: '100vh',
        background: T.bg,
        color: T.text,
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        paddingBottom: 64,
      }}
    >
      <Link
        href="/recipes/chefs"
        style={{
          color: T.textSecondary,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          textDecoration: 'none',
          marginBottom: 32,
          display: 'inline-block',
        }}
      >
        &#x2190; Back to chefs
      </Link>

      <div style={{ width: '100%', maxWidth: 600, margin: '0 auto' }}>
        <div
          style={{
            width: 'fit-content',
            margin: '0 auto 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            borderRadius: 9999,
            background: T.surfaceLow,
            color: T.green,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.12em',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: T.green,
            }}
          />
          RECURRING CHARGES OFF
        </div>

        <header style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            aria-hidden="true"
            style={{
              width: 104,
              height: 104,
              borderRadius: '50%',
              margin: '0 auto 20px',
              display: 'grid',
              placeItems: 'center',
              background: 'rgba(34,197,94,0.07)',
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(34,197,94,0.12)',
              }}
            >
              <Users size={31} color={T.green} strokeWidth={1.8} />
            </div>
          </div>
          <h1
            style={{
              margin: '0 0 10px',
              fontSize: 28,
              lineHeight: 1.25,
              fontWeight: 800,
              letterSpacing: '-0.025em',
            }}
          >
            Chef subscriptions are not available
          </h1>
          <p
            style={{
              maxWidth: 470,
              margin: '0 auto',
              color: T.textSecondary,
              fontSize: 15,
              lineHeight: 1.6,
            }}
          >
            BestChef has no paid tiers for
            {chefName ? ` ${chefName}` : ' chefs'} at launch. No recurring
            subscription can be started on this page.
          </p>
        </header>

        <section
          style={{
            padding: 20,
            borderRadius: 18,
            border: '1px solid rgba(255,255,255,0.06)',
            background: T.surfaceLow,
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div
              aria-hidden="true"
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                background: 'rgba(34,197,94,0.1)',
              }}
            >
              <CreditCard size={20} color={T.green} strokeWidth={2} />
            </div>
            <div>
              <h2 style={{ margin: '1px 0 5px', fontSize: 15, fontWeight: 700 }}>
                No paid tier selection
              </h2>
              <p
                style={{
                  margin: 0,
                  color: T.textSecondary,
                  fontSize: 13,
                  lineHeight: 1.55,
                }}
              >
                Prices, checkout controls, and payment forms are intentionally
                absent.
              </p>
            </div>
          </div>

          <div
            aria-hidden="true"
            style={{
              height: 1,
              margin: '18px 0 18px 54px',
              background: 'rgba(255,255,255,0.06)',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div
              aria-hidden="true"
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                background: 'rgba(34,197,94,0.1)',
              }}
            >
              <ShieldCheck size={20} color={T.green} strokeWidth={2} />
            </div>
            <div>
              <h2 style={{ margin: '1px 0 5px', fontSize: 15, fontWeight: 700 }}>
                No recurring billing
              </h2>
              <p
                style={{
                  margin: 0,
                  color: T.textSecondary,
                  fontSize: 13,
                  lineHeight: 1.55,
                }}
              >
                BestChef will not store a payment method or create a monthly
                charge here. No charge can be made.
              </p>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: 28 }}>
          <div
            style={{
              marginBottom: 10,
              color: T.dimText,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.12em',
            }}
          >
            CONNECT FOR FREE
          </div>
          <div
            style={{
              padding: 20,
              borderRadius: 18,
              border: '1px solid rgba(255,255,255,0.06)',
              background: T.surface,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                background: 'rgba(201,137,77,0.12)',
              }}
            >
              <Users size={21} color={T.gold} strokeWidth={2} />
            </div>
            <div>
              <h2 style={{ margin: '1px 0 5px', fontSize: 16, fontWeight: 700 }}>
                Follow chefs instead
              </h2>
              <p
                style={{
                  margin: 0,
                  color: T.textSecondary,
                  fontSize: 13,
                  lineHeight: 1.55,
                }}
              >
                Recipes, profiles, follows, and community participation remain
                available without a paid chef plan.
              </p>
            </div>
          </div>
        </section>

        <Link
          href="/recipes/chefs"
          style={{
            minHeight: 52,
            borderRadius: 9999,
            background: T.green,
            color: T.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 24px',
            fontSize: 15,
            fontWeight: 800,
            textDecoration: 'none',
          }}
        >
          Browse chefs
        </Link>

        <p
          style={{
            margin: '14px 0 0',
            color: T.dimText,
            fontSize: 12,
            lineHeight: 1.5,
            textAlign: 'center',
          }}
        >
          Paid subscriptions are not available at launch.
        </p>
      </div>
    </main>
  );
}

export default function SubscribePage() {
  return (
    <Suspense fallback={null}>
      <SubscribePageContent />
    </Suspense>
  );
}
