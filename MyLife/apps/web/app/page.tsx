import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { TodayCard as TodayCardType } from '@mylife/module-registry';
import { getQuickActionsForClusters } from '@mylife/module-registry';
import {
  fetchTodayCards,
  fetchEnabledModuleIds,
  fetchPrimaryClusters,
  fetchOnboardingCompleted,
} from '@/app/actions';
import { TodaySection } from '@/components/today/TodaySection';
import { QuickActions } from '@/components/today/QuickActions';
import { TodayFocusEditor } from '@/components/today/TodayFocusEditor';

const BACKGROUND = '#131318';
const TEXT = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Morning';
  if (hour < 18) return 'Afternoon';
  return 'Evening';
}

function formatDate(now: Date): string {
  return now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function isYourDay(card: TodayCardType): boolean {
  return card.kind === 'action' || card.kind === 'reminder' || card.kind === 'event';
}

function isThisWeek(card: TodayCardType): boolean {
  return card.kind === 'progress' || card.kind === 'insight';
}

export default async function HubTodayPage() {
  const onboardingCompleted = await fetchOnboardingCompleted();
  if (!onboardingCompleted) {
    redirect('/onboarding/pledge');
  }

  const [cards, enabledIds, primaryClusters] = await Promise.all([
    fetchTodayCards(),
    fetchEnabledModuleIds(),
    fetchPrimaryClusters(),
  ]);

  const enabledSet = new Set(enabledIds);
  const quickActions = getQuickActionsForClusters(primaryClusters, enabledSet, 5);

  const yourDay = cards.filter(isYourDay);
  const thisWeek = cards.filter(isThisWeek);
  const now = new Date();

  const empty = cards.length === 0 && quickActions.length === 0;

  return (
    <main
      style={{
        background: BACKGROUND,
        color: TEXT,
        minHeight: '100vh',
        padding: '24px 20px 48px',
        maxWidth: 720,
        margin: '0 auto',
      }}
    >
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, lineHeight: '34px' }}>
          {greeting(now)}
        </h1>
        <div style={{ fontSize: 14, color: TEXT_SECONDARY, marginTop: 4 }}>
          {formatDate(now)}
        </div>
        <div style={{ marginTop: 10 }}>
          <TodayFocusEditor clusters={primaryClusters} />
        </div>
      </header>

      {empty ? (
        <EmptyState />
      ) : (
        <>
          <TodaySection label="Your day" cards={yourDay} />
          <TodaySection label="This week" cards={thisWeek} />
          <QuickActions actions={quickActions} />
        </>
      )}

      <nav style={{ marginTop: 32, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Link href="/all" style={{ color: TEXT_SECONDARY, fontSize: 13 }}>
          All modules →
        </Link>
        <Link href="/training-fuel" style={{ color: TEXT_SECONDARY, fontSize: 13 }}>
          Training + Fuel report
        </Link>
        <Link href="/discover" style={{ color: TEXT_SECONDARY, fontSize: 13 }}>
          Discover
        </Link>
      </nav>
    </main>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        border: `1px solid rgba(255,255,255,0.10)`,
        borderRadius: 12,
        padding: 24,
        textAlign: 'center',
        color: TEXT_SECONDARY,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 600, color: TEXT, marginBottom: 6 }}>
        Nothing yet for today
      </div>
      <div style={{ fontSize: 14, marginBottom: 16 }}>
        Enable a module and your day will fill in here.
      </div>
      <Link
        href="/discover"
        style={{
          display: 'inline-block',
          background: '#C9894D',
          color: '#131318',
          fontWeight: 600,
          padding: '8px 16px',
          borderRadius: 8,
          textDecoration: 'none',
        }}
      >
        Browse modules
      </Link>
    </div>
  );
}
